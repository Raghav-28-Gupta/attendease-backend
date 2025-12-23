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
							take: 5, // Last session
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

				// Calculate average attendance
				const sessions = await prisma.attendanceSession.findMany({
					where: { subjectEnrollmentId: enrollment.id },
					include: {
						records: {
							select: {
								status: true,
							},
						},
					},
				});

				let totalPresent = 0;
				let totalPossible = 0;

				sessions.forEach((session) => {
					const presentCount = session.records.filter(
						(r) =>
							r.status === "PRESENT" ||
							r.status === "LATE" ||
							r.status === "EXCUSED"
					).length;
					totalPresent += presentCount;
					totalPossible += session.records.length;
				});

				const averageAttendance =
					totalPossible > 0 ? (totalPresent / totalPossible) * 100 : 0;

				const lastSession = enrollment.attendanceSessions[0]?.date || null;

				return {
					id: enrollment.id,
					subject: enrollment.subject,
					batch: {
						code: enrollment.batch.code,
						name: enrollment.batch.name,
						studentCount,
					},
					stats: {
						totalSessions: sessions.length,
						averageAttendance: Math.round(averageAttendance * 100) / 100,
						lastSession,
					},
				};
			})
		);

		// Calculate overall stats
		const totalEnrollments = enrollments.length;
		const totalBatchesTeaching = new Set(
			teacher.subjectEnrollments.map((e) => e.batch.code)
		).size;
		const totalStudents = enrollments.reduce(
			(sum, e) => sum + e.batch.studentCount,
			0
		);
		const totalSubjects = new Set(
			teacher.subjectEnrollments.map((e) => e.subject.code)
		).size;
		const totalSessions = enrollments.reduce(
			(sum, e) => sum + e.stats.totalSessions,
			0
		);
		const averageAttendance =
			enrollments.length > 0
				? enrollments.reduce(
						(sum, e) => sum + e.stats.averageAttendance,
						0
				  ) / enrollments.length
				: 0;

		// Get recent sessions
		// In getTeacherDashboard(), replace the recentSessions query:

		const recentSessions = await prisma.attendanceSession.findMany({
			where: {
				subjectEnrollment: {
					teacherId: teacher.id,
				},
			},
			include: {
				subjectEnrollment: {
					include: {
						subject: true,
						batch: true,
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
				records: {
					select: {
						status: true,
					},
				},
				_count: {
					select: {
						records: true,
					},
				},
			},
			orderBy: { date: "desc" },
			take:5,
		});

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
						percentage: stats.percentage,
					});
				}
			}
		}

		// Sort by lowest percentage
		lowAttendanceStudents.sort((a, b) => a.percentage - b.percentage);

		return {
			enrollments,
			stats: {
				totalEnrollments,
				totalBatchesTeaching,
				totalSubjects,
				totalStudents,
				totalSessions,
				averageAttendance: Math.round(averageAttendance * 100) / 100,
			},
			recentSessions,
			lowAttendanceStudents: lowAttendanceStudents.slice(0, 10), // Top 10
		};
	}

	/**
	 * Get student dashboard data
	 */
	static async getStudentDashboard(
		userId: string
	): Promise<StudentDashboardData> {
		const student = await prisma.student.findUnique({
			where: { userId },
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
					enrollmentId: enrollment.id,
					code: enrollment.subject.code,
					name: enrollment.subject.name,
					teacherName: `${enrollment.teacher.firstName} ${enrollment.teacher.lastName}`,
					attendance: stats,
				};
			})
		);

		// Get today's classes
		const todayClasses = await TimetableService.getTodayClasses(student.id);

		// Get recent attendance records
		const recentAttendance = await prisma.attendanceRecord.findMany({
			where: { studentId: student.id },
			include: {
				session: {
					select: {
						id: true,
						date: true,
						startTime: true,
						endTime: true,
						subjectEnrollment: {
							select: {
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
			orderBy: {
				session: { date: "desc" },
			},
			take: 10,
		});

		// Generate alerts
		const alerts: any[] = [];

		subjects.forEach((subject) => {
			if (subject.attendance.status === "CRITICAL") {
				alerts.push({
					type: "LOW_ATTENDANCE",
					subject: subject.name,
					message: `Critical: ${subject.attendance.percentage}% attendance in ${subject.name}`,
					percentage: subject.attendance.percentage,
				});
			} else if (subject.attendance.status === "WARNING") {
				alerts.push({
					type: "NEARING_THRESHOLD",
					subject: subject.name,
					message: `Warning: ${subject.attendance.percentage}% attendance in ${subject.name}`,
					percentage: subject.attendance.percentage,
				});
			}
		});

		// Check if absent today
		const today = new Date().toISOString().split("T")[0];
		const todayAbsent = recentAttendance.filter(
			(r) =>
				r.session.date.toISOString().split("T")[0] === today &&
				r.status === "ABSENT"
		);

		todayAbsent.forEach((record) => {
			alerts.push({
				type: "ABSENT_TODAY",
				subject: record.session.subjectEnrollment.subject.name,
				message: `Marked absent in ${record.session.subjectEnrollment.subject.name} today`,
			});
		});

		return {
			student: {
				id: student.id,
				studentId: student.studentId,
				firstName: student.firstName,
				lastName: student.lastName,
			},
			batch: {
				id: student.batch.id,
				code: student.batch.code,
				name: student.batch.name,
				year: student.batch.year,
			},
			subjects,
			todayClasses: todayClasses.classes,
			recentAttendance,
			alerts,
		};
	}
}
