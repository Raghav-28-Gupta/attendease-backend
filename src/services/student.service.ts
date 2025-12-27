import prisma from "@config/database";
import { ApiError } from "@utils/ApiError";
import logger from "@utils/logger";
import type {
	StudentWithDetails,
	UpdateStudentProfileDTO,
} from "@local-types/models.types";

export class StudentService {
	/**
	 * Get student by user ID
	 */
	static async getStudentByUserId(userId: string) {
		const student = await prisma.student.findUnique({
			where: { userId },
			include: {
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
						year: true,
					},
				},
				user: {
					select: {
						email: true,
					},
				},
			},
		});

		if (!student) {
			throw ApiError.notFound("Student profile not found");
		}

		// Ensure batch exists before accessing its fields
		if (!student.batch) {
			throw ApiError.notFound("Student is not assigned to any batch");
		}

		// ✅ Return in the format expected by frontend
		return {
			id: student.id,
			studentId: student.studentId,
			firstName: student.firstName,
			lastName: student.lastName,
			email: student.user.email,
			phone: student.phone,
			batchId: student.batchId,
			batch: {
				code: student.batch.code,
				name: student.batch.name,
				academicYear: student.batch.year,
			},
			createdAt: student.createdAt,
		} as StudentWithDetails;
	}

	/**
	 * Update student profile
	 */
	static async updateStudentProfile(
		userId: string,
		data: UpdateStudentProfileDTO
	) {
		// Verify student exists
		const existingStudent = await prisma.student.findUnique({
			where: { userId },
		});

		if (!existingStudent) {
			throw ApiError.notFound("Student not found");
		}

		// Update student
		const student = await prisma.student.update({
			where: { id: existingStudent.id },
			data: {
				firstName: data.firstName,
				lastName: data.lastName,
				phone: data.phone,
			},
			include: {
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
						year: true,
					},
				},
				user: {
					select: {
						email: true,
					},
				},
			},
		});

		// Ensure batch exists before accessing its fields
		if (!student.batch) {
			throw ApiError.notFound("Student is not assigned to any batch");
		}

		logger.info(`Profile updated for student: ${student.id}`);

		// ✅ Return in the format expected by frontend
		return {
			id: student.id,
			studentId: student.studentId,
			firstName: student.firstName,
			lastName: student.lastName,
			email: student.user.email,
			phone: student.phone,
			batchId: student.batchId,
			batch: {
				code: student.batch.code,
				name: student.batch.name,
				academicYear: student.batch.year,
			},
			createdAt: student.createdAt,
		} as StudentWithDetails;
	}

	/**
	 * Get student's batch with enrolled subjects
	 */
	static async getStudentBatch(userId: string) {
		const student = await prisma.student.findUnique({
			where: { userId },
			include: {
				batch: {
					include: {
						subjectEnrollments: {
							include: {
								subject: {
									select: {
										id: true,
										code: true,
										name: true,
										department: true,
										semester: true,
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
					},
				},
			},
		});

		if (!student) {
			throw ApiError.notFound("Student profile not found");
		}

		if (!student.batch) {
			throw ApiError.badRequest(
				"You are not assigned to any batch. Please contact administration."
			);
		}

		return {
			batch: {
				id: student.batch.id,
				code: student.batch.code,
				name: student.batch.name,
				department: student.batch.department,
				year: student.batch.year,
			},
			subjects: student.batch.subjectEnrollments.map((enrollment) => ({
				enrollmentId: enrollment.id,
				subject: enrollment.subject,
				teacher: {
					name: `${enrollment.teacher.firstName} ${enrollment.teacher.lastName}`,
					employeeId: enrollment.teacher.employeeId,
				},
				room: enrollment.room,
			})),
		};
	}

	/**
	 * Get student by student ID (roll number)
	 * Returns student details with attendance stats per subject
	 */
	static async getStudentById(studentId: string) {
		const student = await prisma.student.findUnique({
			where: { studentId },
			include: {
				user: {
					select: {
						email: true,
						createdAt: true,
					},
				},
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
						department: true,
					},
				},
				attendanceRecords: {
					include: {
						session: {
							include: {
								subjectEnrollment: {
									select: {
										id: true,
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
				},
			},
		});

		if (!student) {
			throw ApiError.notFound("Student not found");
		}

		// Calculate attendance stats per subject
		const enrollments = new Map();
		student.attendanceRecords.forEach((record) => {
			const subjectCode = record.session.subjectEnrollment.subject.code;
			if (!enrollments.has(subjectCode)) {
				enrollments.set(subjectCode, {
					subject: record.session.subjectEnrollment.subject,
					totalSessions: 0,
					attendedSessions: 0,
				});
			}
			const stats = enrollments.get(subjectCode);
			stats.totalSessions++;
			if (record.status === "PRESENT" || record.status === "LATE") {
				stats.attendedSessions++;
			}
		});

		return {
			id: student.id,
			studentId: student.studentId,
			name: `${student.firstName} ${student.lastName}`,
			email: student.user.email,
			batch: student.batch,
			enrollments: Array.from(enrollments.values()).map((stats) => ({
				subject: stats.subject,
				stats: {
					totalSessions: stats.totalSessions,
					attendedSessions: stats.attendedSessions,
					percentage:
						stats.totalSessions > 0
							? (
									(stats.attendedSessions / stats.totalSessions) *
									100
							  ).toFixed(1)
							: 0,
					status:
						stats.totalSessions === 0
							? "NO_DATA"
							: (stats.attendedSessions / stats.totalSessions) * 100 >=
							  75
							? "GOOD"
							: "AT_RISK",
				},
			})),
		};
	}
}
