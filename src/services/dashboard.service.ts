import prisma from "@config/database";
import { ApiError } from "@utils/ApiError";
import logger from "@utils/logger";
import { AttendanceService } from "./attendance.service";
import { TimetableService } from "./timetable.service";
import type {
	TeacherDashboardData,
	StudentDashboardData,
} from "@local-types/models.types";

export class DashboardService {
	/**
	 * Get teacher dashboard data
	 */
	static async getTeacherDashboard(
		teacherUserId: string
	): Promise<TeacherDashboardData> {
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
			include: {
				subjectEnrollments: {
					where: { status: "ACTIVE" }, // ✅ Only active enrollments
					include: {
						subject: {
							select: {
								code: true,
								name: true,
								semester: true,
							},
						},
						batch: {
							select: {
								id: true,
								code: true,
								name: true,
							},
						},
						attendanceSessions: {
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
							take: 1, // Only need the last session
						},
						_count: {
							select: {
								attendanceSessions: true,
							},
						},
					},
				},
			},
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		// Calculate stats for each enrollment
		const enrollments = await Promise.all(
			teacher.subjectEnrollments.map(async (enrollment) => {
				// Get student count for batch
				const studentCount = await prisma.student.count({
					where: { batchId: enrollment.batch.id },
				});

				// ✅ Calculate total sessions from _count
				const totalSessions = enrollment._count?.attendanceSessions ?? 0;

				// ✅ Calculate average attendance from last 5 sessions
				let averageAttendance = 0;

				if (enrollment.attendanceSessions.length > 0) {
					let totalPresent = 0;
					let totalPossible = 0;

					enrollment.attendanceSessions.forEach((session) => {
						const presentCount = session.records.filter(
							(r) => r.status === "PRESENT" || r.status === "LATE"
						).length;
						totalPresent += presentCount;
						totalPossible += session.records.length;
					});

					if (totalPossible > 0) {
						averageAttendance =
							Math.round((totalPresent / totalPossible) * 100 * 100) /
							100;
					}
				}

				return {
					id: enrollment.id,
					subject: {
						code: enrollment.subject.code,
						name: enrollment.subject.name,
						semester: enrollment.subject.semester,
					},
					batch: {
						code: enrollment.batch.code,
						name: enrollment.batch.name,
						studentCount: studentCount || 0, // ✅ Ensure number
					},
					stats: {
						sessionsHeld: totalSessions, // ✅ Changed from totalSessions
						averageAttendance: averageAttendance, // ✅ Always a number
						lastSession: enrollment.attendanceSessions[0]?.date || null,
					},
				};
			})
		);

		// ✅ Calculate overall stats - ensure all are numbers
		const totalEnrollments = enrollments.length || 0;
		const totalBatchesTeaching = await prisma.batch.count();
		const totalSubjects = await prisma.subject.count();
		const totalStudents = enrollments.reduce(
			(sum, e) => sum + (e.batch.studentCount || 0),
			0
		);
		const totalSessions = enrollments.reduce(
			(sum, e) => sum + (e.stats.sessionsHeld || 0),
			0
		);
		const averageAttendance =
			enrollments.length > 0
				? enrollments.reduce(
						(sum, e) => sum + (e.stats.averageAttendance || 0),
						0
				  ) / enrollments.length
				: 0;

		const totalTimetableEntries = await prisma.timetableEntry.count({
			where: {
				subjectEnrollment: {
					teacherId: teacher.id,
				},
			},
		});

		// Get recent sessions
		const recentSessions = await prisma.attendanceSession.findMany({
			where: {
				subjectEnrollment: {
					teacherId: teacher.id,
				},
			},
			take: 5,
			orderBy: { date: "desc" },
			include: {
				subjectEnrollment: {
					include: {
						subject: {
							select: {
								code: true,
								name: true,
								semester: true,
							},
						},
						batch: {
							select: {
								code: true,
								name: true,
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

		// ✅ Format recent sessions with proper field names
		const formattedRecentSessions = recentSessions.map((session) => ({
			id: session.id,
			date: session.date,
			startTime: session.startTime || "00:00:00",
			endTime: session.endTime || "23:59:59",
			subjectEnrollment: {
				subject: {
					code: session.subjectEnrollment.subject.code,
					name: session.subjectEnrollment.subject.name,
					semester: session.subjectEnrollment.subject.semester,
				},
				batch: {
					code: session.subjectEnrollment.batch.code,
					name: session.subjectEnrollment.batch.name,
					studentCount: 0, // Not needed for recent sessions display
				},
			},
			count: {
				records: session._count?.records || 0, // ✅ Ensure it's a number
			},
		}));

		// Find low attendance students
		const lowAttendanceStudents: any[] = [];

		for (const enrollment of teacher.subjectEnrollments) {
			const students = await prisma.student.findMany({
				where: { batchId: enrollment.batch.id },
				select: {
					id: true,
					studentId: true,
					firstName: true,
					lastName: true,
				},
			});

			for (const student of students) {
				const stats = await AttendanceService.getStudentAttendanceStats(
					student.id,
					enrollment.id
				);

				if (stats.percentage < 75 && stats.totalSessions > 0) {
					lowAttendanceStudents.push({
						studentId: student.studentId,
						name: `${student.firstName} ${student.lastName}`,
						batchCode: enrollment.batch.code,
						subjectCode: enrollment.subject.code,
						percentage: Math.round(stats.percentage * 100) / 100, // ✅ Ensure it's a valid number
					});
				}
			}
		}

		// Sort by lowest percentage
		lowAttendanceStudents.sort((a, b) => a.percentage - b.percentage);

		return {
			// @ts-ignore
			enrollments,
			stats: {
				totalEnrollments: totalEnrollments || 0, // ✅ Ensure number
				totalBatchesTeaching: totalBatchesTeaching || 0, // ✅ Ensure number
				totalSubjects: totalSubjects || 0, // ✅ Ensure number
				totalStudents: totalStudents || 0, // ✅ Ensure number
				totalSessions: totalSessions || 0, // ✅ Ensure number
				averageAttendance: Math.round(averageAttendance * 100) / 100 || 0, // ✅ Ensure number
				// @ts-ignore
				totalTimetableEntries: totalTimetableEntries || 0,
			},
			// @ts-ignore
			recentSessions: formattedRecentSessions,
			lowAttendanceStudents: lowAttendanceStudents.slice(0, 10),
		};
	}

	/**
	 * Get student dashboard data
	 */
	static async getStudentDashboard(
		userId: string
	): Promise<StudentDashboardData> {
		try {
			logger.info(`Fetching student dashboard for user: ${userId}`);

			const student = await prisma.student.findUnique({
				where: { userId },
				include: {
					user: {
						select: {
							email: true,
						},
					},
					batch: {
						include: {
							subjectEnrollments: {
								where: { status: "ACTIVE" },
								include: {
									subject: {
										select: {
											code: true,
											name: true,
											semester: true,
										},
									},
									teacher: {
										select: {
											firstName: true,
											lastName: true,
										},
									},
								},
							},
						},
					},
				},
			});

			if (!student) {
				logger.error(`Student not found for userId: ${userId}`);
				throw ApiError.notFound("Student profile not found");
			}

			if (!student.batch) {
				logger.error(`Student ${student.id} not assigned to batch`);
				throw ApiError.notFound("Student not assigned to batch");
			}

			logger.info(
				`Student ${student.id} has ${student.batch.subjectEnrollments.length} enrollments`
			);

			// ✅ Calculate attendance for each subject with error handling

			const subjects = await Promise.all(
				student.batch.subjectEnrollments.map(async (enrollment) => {
					const stats = await AttendanceService.getStudentAttendanceStats(
						student.id,
						enrollment.id
					);

					return {
						subjectCode: enrollment.subject.code,
						subjectName: enrollment.subject.name,
						semester: enrollment.subject.semester || "N/A",
						teacherName: `${enrollment.teacher.firstName} ${enrollment.teacher.lastName}`,
						stats: {
							totalSessions: stats.totalSessions,
							present: stats.present,
							absent: stats.absent,
							late: stats.late,
							excused: stats.excused,
							percentage: Math.round(stats.percentage * 100) / 100,
							status: stats.status as "GOOD" | "WARNING" | "CRITICAL", // ✅ Cast here
						},
					};
				})
			);

			logger.info(`Processed ${subjects.length} subjects`);

			// ✅ Get today's classes with error handling
			let todayClassesData: any[] = [];
			try {
				const timetableResult = await TimetableService.getTodayClasses(
					student.id
				);
				todayClassesData = timetableResult.classes || [];
				logger.info(`Found ${todayClassesData.length} classes today`);
			} catch (error) {
				logger.error("Failed to fetch today's classes:", error);
				todayClassesData = [];
			}

			// ✅ Calculate overview stats
			const totalSubjects = subjects.length;
			const totalSessions = subjects.reduce(
				(sum, s) => sum + (s.stats.totalSessions || 0),
				0
			);
			const classesAttended = subjects.reduce(
				(sum, s) => sum + (s.stats.present || 0),
				0
			);
			const overallAttendance =
				totalSessions > 0
					? Math.round((classesAttended / totalSessions) * 100 * 100) / 100
					: 0;

			const lowAttendanceCount = subjects.filter(
				(s) => s.stats.status === "WARNING" || s.stats.status === "CRITICAL"
			).length;

			logger.info(
				`Dashboard stats: ${totalSubjects} subjects, ${totalSessions} sessions, ${overallAttendance}% attendance`
			);

			// ✅ RETURN STRUCTURE
			const dashboardData: StudentDashboardData = {
				student: {
					id: student.id,
					studentId: student.studentId,
					firstName: student.firstName || student.firstName || "",
					lastName: student.lastName || student.lastName || "",
					email: student.user?.email || "",
					phone: student.phone || null,
					batch: {
						code: student.batch.code,
						name: student.batch.name,
						academicYear: student.batch.year,
					},
				},
				subjects: subjects,
				overview: {
					totalSubjects: totalSubjects,
					overallAttendance: overallAttendance,
					totalSessions: totalSessions,
					classesAttended: classesAttended,
					lowAttendanceCount: lowAttendanceCount,
				},
				todayClasses: todayClassesData,
			};

			logger.info(
				`Student dashboard successfully compiled for ${student.id}`
			);

			return dashboardData;
		} catch (error) {
			logger.error("Error in getStudentDashboard:", error);
			throw error;
		}
	}
}
