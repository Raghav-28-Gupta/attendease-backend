import prisma from "@config/database";
import { ApiError } from "@utils/ApiError";
import logger from "@utils/logger";
import type { UpdateStudentProfileDTO } from "@local-types/models.types";

export class StudentService {
	/**
	 * Get student by user ID
	 */
	static async getStudentByUserId(userId: string) {
		const student = await prisma.student.findUnique({
			where: { userId },
			include: {
				user: {
					select: {
						email: true,
						role: true,
						createdAt: true,
					},
				},
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
						department: true,
						year: true,
					},
				},
			},
		});

		if (!student) {
			throw ApiError.notFound("Student profile not found");
		}

		return student;
	}

	/**
	 * Update student profile
	 */
	static async updateStudentProfile(
		userId: string,
		data: UpdateStudentProfileDTO
	) {
		// Verify student exists
		const student = await prisma.student.findUnique({
			where: { userId },
		});

		if (!student) {
			throw ApiError.notFound("Student profile not found");
		}

		// Update profile
		const updated = await prisma.student.update({
			where: { id: student.id },
			data: {
				firstName: data.firstName,
				lastName: data.lastName,
				phone: data.phone,
			},
			include: {
				user: {
					select: {
						email: true,
						role: true,
					},
				},
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
						department: true,
						year: true,
					},
				},
			},
		});

		logger.info(`Student profile updated: ${student.id}`);

		return updated;
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
}
