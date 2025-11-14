import prisma from "@config/database";
import { ApiError } from "@utils/ApiError";
import logger from "@utils/logger";
import { WebSocketService } from "./websocket.service";
import type {
	CreateAttendanceSessionDTO,
	MarkAttendanceDTO,
	UpdateAttendanceDTO,
	AttendanceSessionWithDetails,
	AttendanceRecordWithStudent,
	AttendanceStatsDTO,
	SubjectAttendanceSummary,
	SessionWithRecords,
} from "@local-types/models.types";
import type { AttendanceStatus } from "@prisma/client";
import { includes } from "zod";

export class AttendanceService {
	/**
	 * Create attendance session for a subject-batch enrollment
	 */
	static async createSession(
		teacherUserId: string,
		data: CreateAttendanceSessionDTO
	): Promise<AttendanceSessionWithDetails> {
		// 1. Verify teacher owns this enrollment
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		const enrollment = await prisma.subjectEnrollment.findUnique({
			where: { id: data.subjectEnrollmentId },
			include: {
				subject: true,
				batch: true,
				teacher: true,
			},
		});

		if (!enrollment) {
			throw ApiError.notFound("Subject enrollment not found");
		}

		if (enrollment.teacherId !== teacher.id) {
			throw ApiError.forbidden(
				"You do not teach this subject to this batch"
			);
		}

		// 2. Check for duplicate session (same date and time)
		const existingSession = await prisma.attendanceSession.findFirst({
			where: {
				subjectEnrollmentId: data.subjectEnrollmentId,
				date: new Date(data.date),
				startTime: data.startTime,
			},
		});

		if (existingSession) {
			throw ApiError.badRequest(
				`Attendance session already exists for ${enrollment.subject.name} (${enrollment.batch.code}) on this date and time`
			);
		}

		// 3. Create session
		const session = await prisma.attendanceSession.create({
			data: {
				subjectEnrollmentId: data.subjectEnrollmentId,
				teacherId: teacher.id,
				date: new Date(data.date),
				startTime: data.startTime,
				endTime: data.endTime,
				type: data.type || "REGULAR",
			},
			include: {
				subjectEnrollment: {
					include: {
						subject: {
							select: {
								id: true,
								code: true,
								name: true,
							},
						},
						batch: {
							select: {
								id: true,
								code: true,
								name: true,
							},
						},
						teacher: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								employeeId: true,
							},
						},
					},
				},
				_count: {
					select: {
						records: true,
					},
				},
			},
		});

		logger.info(
			`Attendance session created: ${enrollment.subject.code} - ${enrollment.batch.code} on ${data.date}`
		);

		// EMIT WEBSOCKET EVENT (with error handling)
		try {
			WebSocketService.emitSessionCreated(data.subjectEnrollmentId, {
				id: session.id,
				date: session.date,
				startTime: session.startTime,
				endTime: session.endTime,
				type: session.type,
				subjectEnrollment: {
					subject: {
						code: session.subjectEnrollment.subject.code,
						name: session.subjectEnrollment.subject.name,
					},
					batch: {
						code: session.subjectEnrollment.batch.code,
						name: session.subjectEnrollment.batch.name,
					},
					teacher: {
						firstName: session.subjectEnrollment.teacher.firstName,
						lastName: session.subjectEnrollment.teacher.lastName,
					},
				},
			} as AttendanceSessionWithDetails);
		} catch (wsError) {
			logger.error("WebSocket emission failed (createSession):", wsError);
		}

		return session;
	}

	/**
	 * Get students for a session (from the batch)
	 */
	static async getSessionStudents(
		sessionId: string,
		teacherUserId: string
	): Promise<AttendanceRecordWithStudent[]> {
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		const session = await prisma.attendanceSession.findUnique({
			where: { id: sessionId },
			include: {
				subjectEnrollment: {
					include: {
						batch: {
							include: {
								students: {
									where: { batchId: { not: null } },
									orderBy: { studentId: "asc" },
									select: {
										id: true,
										studentId: true,
										firstName: true,
										lastName: true,
										userId: true, // Add userId for WebSocket
									},
								},
							},
						},
					},
				},
				records: {
					include: {
						student: {
							select: {
								id: true,
								studentId: true,
								firstName: true,
								lastName: true,
								userId: true, // Add userId
							},
						},
					},
				},
			},
		});

		if (!session) {
			throw ApiError.notFound("Attendance session not found");
		}

		// Verify ownership
		if (session.teacherId !== teacher.id) {
			throw ApiError.forbidden("You do not have access to this session");
		}

		// If records already exist, return them
		if (session.records.length > 0) {
			return session.records;
		}

		// Check if batch has students
		if (session.subjectEnrollment.batch.students.length === 0) {
			throw ApiError.badRequest(
				`No students are assigned to batch ${session.subjectEnrollment.batch.code}. Please assign students before taking attendance.`
			);
		}

		// Otherwise, return students from batch (unmarked)
		return session.subjectEnrollment.batch.students.map((student) => ({
			id: "", // No record ID yet
			sessionId: session.id,
			studentId: student.id,
			status: "PRESENT" as AttendanceStatus, // Default
			markedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
			student,
		}));
	}

	/**
	 * Mark attendance (bulk operation with WebSocket events)
	 */
	static async markAttendance(teacherUserId: string, data: MarkAttendanceDTO) {
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		// Verify session ownership
		const session = await prisma.attendanceSession.findUnique({
			where: { id: data.sessionId },
			include: {
				subjectEnrollment: {
					include: {
						subject: {
							select: {
								id: true,
								code: true,
								name: true,
							},
						},
						batch: {
							select: {
								id: true,
								code: true,
								name: true,
							},
						},
						teacher: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
							},
						},
					},
				},
			},
		});

		if (!session) {
			throw ApiError.notFound("Session not found");
		}

		if (session.teacherId !== teacher.id) {
			throw ApiError.forbidden("You do not have access to this session");
		}

		// Verify all students belong to the batch
		const batchStudentIds = await prisma.student.findMany({
			where: { batchId: session.subjectEnrollment.batchId },
			select: { id: true, userId: true }, // Include userId
		});

		const validStudentIds = new Set(batchStudentIds.map((s) => s.id));

		for (const record of data.records) {
			if (!validStudentIds.has(record.studentId)) {
				throw ApiError.badRequest(
					`Student ${record.studentId} is not in batch ${session.subjectEnrollment.batch.code}`
				);
			}
		}

		// KEEP YOUR EXISTING UPSERT LOGIC (atomic and idempotent)
		const createdRecords = await prisma.$transaction(
			data.records.map((record) =>
				prisma.attendanceRecord.upsert({
					where: {
						sessionId_studentId: {
							sessionId: data.sessionId,
							studentId: record.studentId,
						},
					},
					update: {
						status: record.status,
						markedAt: new Date(),
					},
					create: {
						sessionId: data.sessionId,
						studentId: record.studentId,
						status: record.status,
						markedAt: new Date(),
					},
					include: {
						student: {
							select: {
								id: true,
								studentId: true,
								firstName: true,
								lastName: true,
								userId: true, // Add userId
							},
						},
					},
				})
			)
		);

		logger.info(
			`Attendance marked: ${createdRecords.length} students for session ${data.sessionId}`
		);

		// EMIT WEBSOCKET EVENTS (with error handling)
		try {
			// 1. Emit batch-wide notification
			WebSocketService.emitAttendanceMarked(
				session.subjectEnrollment.batchId,
				{
					id: session.id,
					date: session.date,
					startTime: session.startTime,
					endTime: session.endTime,
					type: session.type,
					subjectEnrollment: {
						subject: {
							code: session.subjectEnrollment.subject.code,
							name: session.subjectEnrollment.subject.name,
						},
						batch: {
							code: session.subjectEnrollment.batch.code,
							name: session.subjectEnrollment.batch.name,
						},
						teacher: {
							firstName: session.subjectEnrollment.teacher.firstName,
							lastName: session.subjectEnrollment.teacher.lastName,
						},
					},
				} as AttendanceSessionWithDetails,
				createdRecords.length
			);

			// 2. Calculate live session progress
			const presentCount = createdRecords.filter(
				(r) => r.status === "PRESENT" || r.status === "LATE"
			).length;
			const absentCount = createdRecords.filter(
				(r) => r.status === "ABSENT"
			).length;

			WebSocketService.emitLiveSessionStatus(session.subjectEnrollmentId, {
				sessionId: session.id,
				totalStudents: batchStudentIds.length,
				markedCount: createdRecords.length,
				presentCount,
				absentCount,
			});

			// 3. OPTIMIZED: Only process students who were marked
			const markedStudentIds = new Set(
				createdRecords.map((r) => r.studentId)
			);
			const markedStudents = batchStudentIds.filter((s) =>
				markedStudentIds.has(s.id)
			);

			// Process each marked student
			for (const studentData of markedStudents) {
				// Calculate updated stats
				const stats = await this.getStudentAttendanceStats(
					studentData.id,
					session.subjectEnrollmentId
				);

				// Emit attendance updated event
				WebSocketService.emitAttendanceUpdated(studentData.userId, {
					subjectCode: session.subjectEnrollment.subject.code,
					subjectName: session.subjectEnrollment.subject.name,
					newPercentage: stats.percentage,
					status: stats.status,
					stats,
				});

				// Send low attendance alert if needed
				if (stats.status === "WARNING" || stats.status === "CRITICAL") {
					const attendedCount = stats.present + stats.late + stats.excused;
					const requiredPercentage = 0.75;

					// Calculate sessions needed to reach 75%
					// Formula: (attended + x) / (total + x) = 0.75
					// Solving for x: x = (0.75 * total - attended) / (1 - 0.75)
					const sessionsNeeded = Math.ceil(
						(requiredPercentage * stats.totalSessions - attendedCount) /
							(1 - requiredPercentage)
					);

					WebSocketService.emitLowAttendanceAlert(studentData.userId, {
						subjectCode: session.subjectEnrollment.subject.code,
						subjectName: session.subjectEnrollment.subject.name,
						percentage: stats.percentage,
						sessionsNeeded: Math.max(sessionsNeeded, 1),
						status: stats.status,
					});
				}
			}
		} catch (wsError) {
			// Don't fail attendance marking if WebSocket fails
			logger.error("WebSocket emission failed (markAttendance):", wsError);
		}

		return {
			message: `Attendance marked for ${createdRecords.length} students`,
			records: createdRecords,
		};
	}

	/**
	 * Update single attendance record (with audit trail and WebSocket)
	 */
	static async updateAttendanceRecord(
		recordId: string,
		teacherUserId: string,
		data: UpdateAttendanceDTO
	) {
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		const record = await prisma.attendanceRecord.findUnique({
			where: { id: recordId },
			include: {
				session: {
					include: {
						subjectEnrollment: {
							include: {
								subject: {
									select: {
										id: true,
										code: true,
										name: true,
									},
								},
								batch: true,
							},
						},
					},
				},
				student: {
					select: {
						id: true,
						userId: true, // Add userId
						studentId: true,
						firstName: true,
						lastName: true,
					},
				},
			},
		});

		if (!record) {
			throw ApiError.notFound("Attendance record not found");
		}

		// Verify ownership
		if (record.session.teacherId !== teacher.id) {
			throw ApiError.forbidden("You cannot edit this attendance record");
		}

		const oldStatus = record.status;

		// Update record with transaction
		const updated = await prisma.$transaction(async (tx) => {
			// Create audit log
			await tx.attendanceEdit.create({
				data: {
					recordId: record.id,
					sessionId: record.sessionId,
					editedBy: teacherUserId,
					oldStatus,
					newStatus: data.status,
					reason: data.reason || "No reason provided",
				},
			});

			// Update record
			return tx.attendanceRecord.update({
				where: { id: recordId },
				data: {
					status: data.status,
					updatedAt: new Date(),
				},
				include: {
					student: {
						select: {
							id: true,
							userId: true, // Include userId
							studentId: true,
							firstName: true,
							lastName: true,
						},
					},
					session: {
						select: {
							id: true,
							date: true,
							subjectEnrollment: {
								select: {
									id: true,
									subject: {
										select: { code: true, name: true },
									},
								},
							},
						},
					},
				},
			});
		});

		logger.info(
			`Attendance edited: Student ${record.student.studentId} - ${oldStatus} → ${data.status}`
		);

		// EMIT WEBSOCKET EVENTS (with error handling)
		try {
			// Emit edit notification
			WebSocketService.emitAttendanceEdited(updated.student.userId, {
				recordId: updated.id,
				sessionId: updated.sessionId,
				subjectCode: updated.session.subjectEnrollment.subject.code,
				oldStatus,
				newStatus: data.status,
				editedBy: teacherUserId,
				reason: data.reason || "No reason provided",
			});

			// Recalculate and emit updated stats
			const stats = await this.getStudentAttendanceStats(
				updated.student.id,
				updated.session.subjectEnrollment.id
			);

			WebSocketService.emitAttendanceUpdated(updated.student.userId, {
				subjectCode: updated.session.subjectEnrollment.subject.code,
				subjectName: updated.session.subjectEnrollment.subject.name,
				newPercentage: stats.percentage,
				status: stats.status,
				stats,
			});

			// Send low attendance alert if needed
			if (stats.status === "WARNING" || stats.status === "CRITICAL") {
				const attendedCount = stats.present + stats.late + stats.excused;
				const requiredPercentage = 0.75;

				const sessionsNeeded = Math.ceil(
					(requiredPercentage * stats.totalSessions - attendedCount) /
						(1 - requiredPercentage)
				);

				WebSocketService.emitLowAttendanceAlert(updated.student.userId, {
					subjectCode: updated.session.subjectEnrollment.subject.code,
					subjectName: updated.session.subjectEnrollment.subject.name,
					percentage: stats.percentage,
					sessionsNeeded: Math.max(sessionsNeeded, 1),
					status: stats.status,
				});
			}
		} catch (wsError) {
			logger.error("WebSocket emission failed (updateRecord):", wsError);
		}

		return {
			message: "Attendance record updated successfully",
			record: updated,
		};
	}

	// KEEP ALL EXISTING METHODS UNCHANGED
	static async getSessionById(
		sessionId: string,
		teacherUserId?: string
	): Promise<SessionWithRecords> {
		// ... existing code unchanged ...
		const session = await prisma.attendanceSession.findUnique({
			where: { id: sessionId },
			include: {
				subjectEnrollment: {
					include: {
						subject: {
							select: { code: true, name: true },
						},
						batch: {
							select: { code: true, name: true },
						},
						teacher: true,
					},
				},
				records: {
					include: {
						student: {
							select: {
								id: true,
								studentId: true,
								firstName: true,
								lastName: true,
							},
						},
					},
					orderBy: {
						student: { studentId: "asc" },
					},
				},
			},
		});

		if (!session) {
			throw ApiError.notFound("Session not found");
		}

		if (teacherUserId) {
			if (session.subjectEnrollment.teacher.userId !== teacherUserId) {
				throw ApiError.forbidden("You do not have access to this session");
			}
		}

		return session;
	}

	static async getTeacherSessions(
		teacherUserId: string,
		limit: number = 20
	): Promise<AttendanceSessionWithDetails[]> {
		// ... existing code unchanged ...
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		const sessions = await prisma.attendanceSession.findMany({
			where: { teacherId: teacher.id },
			include: {
				subjectEnrollment: {
					include: {
						subject: {
							select: {
								id: true,
								code: true,
								name: true,
							},
						},
						batch: {
							select: {
								id: true,
								code: true,
								name: true,
							},
						},
						teacher: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								employeeId: true,
							},
						},
					},
				},
				_count: {
					select: {
						records: true,
					},
				},
			},
			orderBy: [{ date: "desc" }, { startTime: "desc" }],
			take: limit,
		});

		return sessions;
	}

	static async getEnrollmentSessions(
		enrollmentId: string,
		teacherUserId: string
	): Promise<AttendanceSessionWithDetails[]> {
		// ... existing code unchanged ...
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		const enrollment = await prisma.subjectEnrollment.findUnique({
			where: { id: enrollmentId },
		});

		if (!enrollment) {
			throw ApiError.notFound("Enrollment not found");
		}

		if (enrollment.teacherId !== teacher.id) {
			throw ApiError.forbidden(
				"You do not teach this subject-batch combination"
			);
		}

		const sessions = await prisma.attendanceSession.findMany({
			where: { subjectEnrollmentId: enrollmentId },
			include: {
				subjectEnrollment: {
					include: {
						subject: {
							select: {
								id: true,
								code: true,
								name: true,
							},
						},
						batch: {
							select: {
								id: true,
								code: true,
								name: true,
							},
						},
						teacher: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								employeeId: true,
							},
						},
					},
				},
				_count: {
					select: {
						records: true,
					},
				},
			},
			orderBy: [{ date: "desc" }, { startTime: "desc" }],
		});

		return sessions;
	}

	static async getStudentAttendanceStats(
		studentId: string,
		subjectEnrollmentId: string
	): Promise<AttendanceStatsDTO> {
		// ... existing code unchanged ...
		const sessions = await prisma.attendanceSession.findMany({
			where: { subjectEnrollmentId },
			select: { id: true },
		});

		const totalSessions = sessions.length;

		if (totalSessions === 0) {
			return {
				totalSessions: 0,
				present: 0,
				absent: 0,
				late: 0,
				excused: 0,
				percentage: 0,
				status: "GOOD",
			};
		}

		const records = await prisma.attendanceRecord.findMany({
			where: {
				studentId,
				sessionId: { in: sessions.map((s) => s.id) },
			},
		});

		const stats = {
			present: records.filter((r) => r.status === "PRESENT").length,
			absent: records.filter((r) => r.status === "ABSENT").length,
			late: records.filter((r) => r.status === "LATE").length,
			excused: records.filter((r) => r.status === "EXCUSED").length,
		};

		const attendedCount = stats.present + stats.late + stats.excused;
		const percentage = (attendedCount / totalSessions) * 100;

		let status: "GOOD" | "WARNING" | "CRITICAL" = "GOOD";
		if (percentage < 65) {
			status = "CRITICAL";
		} else if (percentage < 75) {
			status = "WARNING";
		}

		return {
			totalSessions,
			present: stats.present,
			absent: stats.absent,
			late: stats.late,
			excused: stats.excused,
			percentage: Math.round(percentage * 100) / 100,
			status,
		};
	}

	static async getEnrollmentAttendanceSummary(
		enrollmentId: string,
		teacherUserId: string
	): Promise<SubjectAttendanceSummary> {
		// ... existing code unchanged ...
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		const enrollment = await prisma.subjectEnrollment.findUnique({
			where: { id: enrollmentId },
			include: {
				subject: {
					select: {
						code: true,
						name: true,
					},
				},
				batch: {
					select: {
						code: true,
						name: true,
						students: {
							select: { id: true },
						},
					},
				},
			},
		});

		if (!enrollment) {
			throw ApiError.notFound("Enrollment not found");
		}

		if (enrollment.teacherId !== teacher.id) {
			throw ApiError.forbidden(
				"You do not teach this subject-batch combination"
			);
		}

		const sessions = await prisma.attendanceSession.findMany({
			where: { subjectEnrollmentId: enrollmentId },
			select: {
				id: true,
				date: true,
				records: {
					select: {
						status: true,
					},
				},
			},
			orderBy: { date: "desc" },
		});

		const totalSessions = sessions.length;
		const totalStudents = enrollment.batch.students.length;
		const lastSession = sessions[0]?.date || null;

		if (totalSessions === 0 || totalStudents === 0) {
			return {
				subjectEnrollment: {
					id: enrollment.id,
					subject: enrollment.subject,
					batch: {
						code: enrollment.batch.code,
						name: enrollment.batch.name,
					},
				},
				stats: {
					totalSessions,
					totalStudents,
					averageAttendance: 0,
					lastSession,
				},
			};
		}

		let totalPresent = 0;
		sessions.forEach((session) => {
			const presentCount = session.records.filter(
				(r) =>
					r.status === "PRESENT" ||
					r.status === "LATE" ||
					r.status === "EXCUSED"
			).length;
			totalPresent += presentCount;
		});

		const averageAttendance =
			totalSessions > 0 && totalStudents > 0
				? (totalPresent / (totalSessions * totalStudents)) * 100
				: 0;

		return {
			subjectEnrollment: {
				id: enrollment.id,
				subject: enrollment.subject,
				batch: {
					code: enrollment.batch.code,
					name: enrollment.batch.name,
				},
			},
			stats: {
				totalSessions,
				totalStudents,
				averageAttendance: Math.round(averageAttendance * 100) / 100,
				lastSession,
			},
		};
	}

	static async getStudentAttendanceSummary(studentUserId: string): Promise<{
		student: {
			studentId: string;
			firstName: string;
			lastName: string;
		};
		subjects: {
			subject: {
				code: string;
				name: string;
			};
			stats: AttendanceStatsDTO;
		}[];
		overall: {
			totalSessions: number;
			totalPresent: number;
			averagePercentage: number;
			status: "GOOD" | "WARNING" | "CRITICAL";
		};
	}> {
		const student = await prisma.student.findUnique({
			where: { userId: studentUserId },
			include: {
				batch: {
					include: {
						subjectEnrollments: {
							include: {
								subject: {
									select: {
										code: true,
										name: true,
									},
								},
							},
						},
					},
				},
			},
		});

		if (!student) {
			throw ApiError.notFound("Student profile not found");
		}

		if (!student.batch) {
			throw ApiError.notFound("Student not assigned to batch");
		}

		// Calculate attendance for each subject
		const subjects = await Promise.all(
			student.batch.subjectEnrollments.map(async (enrollment) => {
				const stats = await AttendanceService.getStudentAttendanceStats(
					student.id,
					enrollment.id
				);

				return {
					subject: enrollment.subject,
					stats,
				};
			})
		);

		// Calculate overall stats
		const totalSessions = subjects.reduce(
			(sum, subj) => sum + subj.stats.totalSessions,
			0
		);
		const totalPresent = subjects.reduce(
			(sum, subj) =>
				sum + subj.stats.present + subj.stats.late + subj.stats.excused,
			0
		);
		const averagePercentage =
			totalSessions > 0 ? (totalPresent / totalSessions) * 100 : 0;

		let overallStatus: "GOOD" | "WARNING" | "CRITICAL" = "GOOD";
		if (averagePercentage < 65) {
			overallStatus = "CRITICAL";
		} else if (averagePercentage < 75) {
			overallStatus = "WARNING";
		}

		return {
			student: {
				studentId: student.studentId,
				firstName: student.firstName,
				lastName: student.lastName,
			},
			subjects,
			overall: {
				totalSessions,
				totalPresent,
				averagePercentage: Math.round(averagePercentage * 100) / 100,
				status: overallStatus,
			},
		};
	}

	/**
	 * Get logged-in student's attendance for a specific subject by subject code
	 */
	static async getMyAttendanceBySubjectCode(
		studentUserId: string,
		subjectCode: string
	): Promise<{
		subject: {
			code: string;
			name: string;
			semester: string;
		};
		batch: {
			code: string;
			name: string;
		};
		teacher: {
			firstName: string;
			lastName: string;
			employeeId: string;
		};
		stats: AttendanceStatsDTO;
		recentSessions: {
			id: string;
			date: Date;
			startTime: string;
			endTime: string;
			status: AttendanceStatus | null; // Student's attendance status for this session
			markedAt: Date | null;
		}[];
	}> {
		// 1. Get student profile
		const student = await prisma.student.findUnique({
			where: { userId: studentUserId },
			include: {
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
					},
				},
			},
		});

		if (!student) {
			throw ApiError.notFound("Student profile not found");
		}

		if (!student.batch) {
			throw ApiError.notFound("You are not assigned to any batch");
		}

		// 2. Find the subject by code
		const subject = await prisma.subject.findUnique({
			where: { code: subjectCode.toUpperCase() },
			select: {
				id: true,
				code: true,
				name: true,
				semester: true,
			},
		});

		if (!subject) {
			throw ApiError.notFound(`Subject with code ${subjectCode} not found`);
		}

		// 3. Find the enrollment (subject-batch-teacher link)
		const enrollment = await prisma.subjectEnrollment.findFirst({
			where: {
				subjectId: subject.id,
				batchId: student.batch.id,
				status: "ACTIVE",
			},
			include: {
				teacher: {
					select: {
						firstName: true,
						lastName: true,
						employeeId: true,
					},
				},
			},
		});

		if (!enrollment) {
			throw ApiError.notFound(
				`Your batch is not enrolled in ${subject.code} (${subject.name})`
			);
		}

		// 4. Get attendance stats
		const stats = await this.getStudentAttendanceStats(
			student.id,
			enrollment.id
		);

		// 5. Get recent sessions with student's attendance status
		const sessions = await prisma.attendanceSession.findMany({
			where: { subjectEnrollmentId: enrollment.id },
			select: {
				id: true,
				date: true,
				startTime: true,
				endTime: true,
				records: {
					where: { studentId: student.id },
					select: {
						status: true,
						markedAt: true,
					},
				},
			},
			orderBy: { date: "desc" },
			take: 10, // Last 10 sessions
		});

		const recentSessions = sessions.map((session) => ({
			id: session.id,
			date: session.date,
			startTime: session.startTime,
			endTime: session.endTime,
			status: session.records[0]?.status || null,
			markedAt: session.records[0]?.markedAt || null,
		}));

		return {
			subject: {
				code: subject.code,
				name: subject.name,
				semester: subject.semester,
			},
			batch: {
				code: student.batch.code,
				name: student.batch.name,
			},
			teacher: enrollment.teacher,
			stats,
			recentSessions,
		};
	}


	static async deleteSession(sessionId: string, teacherUserId: string) {
		// ... existing code unchanged ...
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		const session = await prisma.attendanceSession.findUnique({
			where: { id: sessionId },
			include: {
				_count: {
					select: {
						records: true,
					},
				},
			},
		});

		if (!session) {
			throw ApiError.notFound("Session not found");
		}

		if (session.teacherId !== teacher.id) {
			throw ApiError.forbidden("You cannot delete this session");
		}

		try {
			await prisma.$transaction(async (tx) => {
				const recordCount = await tx.attendanceRecord.count({
					where: { sessionId },
				});

				if (recordCount > 0) {
					throw ApiError.badRequest(
						"Cannot delete session with marked attendance. Edit records instead."
					);
				}

				await tx.attendanceSession.delete({
					where: { id: sessionId },
				});
			});

			logger.info(`Attendance session deleted: ${sessionId}`);
			return { message: "Session deleted successfully" };
		} catch (error) {
			if (error instanceof ApiError) throw error;
			throw ApiError.internal("Failed to delete session");
		}
	}
}
