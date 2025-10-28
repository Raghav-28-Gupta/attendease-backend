import prisma from "@config/database";
import { ApiError } from "@utils/ApiError";
import logger from "@utils/logger";
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
	 * Mark attendance (bulk operation)
	 */
	static async markAttendance(
		teacherUserId: string,
		data: MarkAttendanceDTO
	) {
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
						subject: true,
						batch: true,
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
			select: { id: true },
		});

		const validStudentIds = new Set(batchStudentIds.map((s) => s.id));

		for (const record of data.records) {
			if (!validStudentIds.has(record.studentId)) {
				throw ApiError.badRequest(
					`Student ${record.studentId} is not in batch ${session.subjectEnrollment.batch.code}`
				);
			}
		}

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
							},
						},
					},
				})
			)
		);

		logger.info(
			`Attendance marked: ${createdRecords.length} students for session ${data.sessionId}`
		);

		return {
			message: `Attendance marked for ${createdRecords.length} students`,
			records: createdRecords,
		};
	}

	/**
	 * Update single attendance record (with audit trail)
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
								subject: true,
								batch: true,
							},
						},
					},
				},
				student: {
					select: {
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

		// Update record
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
							studentId: true,
							firstName: true,
							lastName: true,
						},
					},
					session: {
						select: {
							date: true,
							subjectEnrollment: {
								select: {
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

		return {
			message: "Attendance record updated successfully",
			record: updated,
		};
	}

	/**
	 * Get attendance session by ID with all records
	 */
	static async getSessionById(
		sessionId: string,
		teacherUserId?: string
	): Promise<SessionWithRecords> {
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

		// Verify ownership if teacherUserId provided
		if (teacherUserId) {
			if (session.subjectEnrollment.teacher.userId !== teacherUserId) {
				throw ApiError.forbidden(
					"You do not have access to this session"
				);
			}
		}

		return session;
	}

	/**
	 * Get all sessions for a teacher (recent first)
	 */
	static async getTeacherSessions(
		teacherUserId: string,
		limit: number = 20
	): Promise<AttendanceSessionWithDetails[]> {
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

	/**
	 * Get sessions for a specific enrollment
	 */
	static async getEnrollmentSessions(
		enrollmentId: string,
		teacherUserId: string
	): Promise<AttendanceSessionWithDetails[]> {
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		// Verify teacher owns enrollment
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

	/**
	 * Calculate student attendance statistics for a subject
	 */
	static async getStudentAttendanceStats(
		studentId: string,
		subjectEnrollmentId: string
	): Promise<AttendanceStatsDTO> {
		// Get all sessions for this enrollment
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

		// Get student's attendance records
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

		// Calculate percentage (count LATE and EXCUSED as present)
		const attendedCount = stats.present + stats.late + stats.excused;
		const percentage = (attendedCount / totalSessions) * 100;

		// Determine status
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
			percentage: Math.round(percentage * 100) / 100, // Round to 2 decimals
			status,
		};
	}

	/**
	 * Get attendance summary for all students in an enrollment
	 */
	static async getEnrollmentAttendanceSummary(
		enrollmentId: string,
		teacherUserId: string
	): Promise<SubjectAttendanceSummary> {
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

		// Get all sessions
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

		// edge cases: batch has no students
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

		// Calculate average attendance
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

	/**
	 * Delete attendance session (only if no records marked)
	 */
	static async deleteSession(sessionId: string, teacherUserId: string) {
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

		// Using transaction for atomicity
		try {
			await prisma.$transaction(async (tx) => {
				// Re-check record count inside transaction
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
