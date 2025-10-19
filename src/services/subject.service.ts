import prisma from "@config/database";
import { ApiError } from "@utils/ApiError";
import logger from "@utils/logger";
import type {
	CreateSubjectDTO,
	UpdateSubjectDTO,
	SubjectWithRelations,
} from "@local-types/models.types";

export class SubjectService {
	/**
	 * Create subject with multiple batches
	 */
	static async createSubject(
		teacherId: string,
		data: CreateSubjectDTO
	): Promise<SubjectWithRelations> {
		// Check if subject code already exists
		const existingSubject = await prisma.subject.findUnique({
			where: { code: data.code },
		});

		if (existingSubject) {
			throw ApiError.badRequest(
				`Subject code ${data.code} already exists`
			);
		}

		// Create subject with batches in transaction
		const subject = await prisma.$transaction(async (tx) => {
			// Create subject
			const newSubject = await tx.subject.create({
				data: {
					teacherId,
					name: data.name,
					code: data.code,
					semester: data.semester,
					department: data.department,
				},
			});

			// Create batches with unique codes
			const batchPromises = data.batches.map((batch, index) => {
				const batchCode = `${data.code}-${batch.name
					.toUpperCase()
					.replace(/\s+/g, "")}`;

				return tx.batch.create({
					data: {
						subjectId: newSubject.id,
						name: batch.name,
						code: batchCode,
						capacity: batch.capacity,
						room: batch.room,
					},
				});
			});

			const createdBatches = await Promise.all(batchPromises);

			// Return subject with batches
			return tx.subject.findUnique({
				where: { id: newSubject.id },
				include: {
					teacher: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							employeeId: true,
						},
					},
					batches: {
						include: {
							_count: {
								select: {
									students: true,
									timetableEntries: true,
									attendanceSessions: true,
								},
							},
						},
					},
				},
			});
		});

		logger.info(
			`Subject created: ${data.code} with ${data.batches.length} batches`
		);

		return subject as SubjectWithRelations;
	}

	/**
	 * Get all subjects for a teacher
	 */
	static async getTeacherSubjects(teacherId: string) {
		const subjects = await prisma.subject.findMany({
			where: { teacherId },
			include: {
				batches: {
					include: {
						_count: {
							select: {
								students: true,
								timetableEntries: true,
								attendanceSessions: true,
							},
						},
					},
					orderBy: { name: "asc" },
				},
			},
			orderBy: { createdAt: "desc" },
		});

		return subjects;
	}

	/**
	 * Get single subject with details
	 */
	static async getSubjectById(
		subjectId: string,
		teacherId?: string
	): Promise<SubjectWithRelations> {
		const subject = await prisma.subject.findUnique({
			where: { id: subjectId },
			include: {
				teacher: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						employeeId: true,
					},
				},
				batches: {
					include: {
						_count: {
							select: {
								students: true,
								timetableEntries: true,
								attendanceSessions: true,
							},
						},
					},
					orderBy: { name: "asc" },
				},
			},
		});

		if (!subject) {
			throw ApiError.notFound("Subject not found");
		}

		// Verify ownership if teacherId provided
		if (teacherId && subject.teacherId !== teacherId) {
			throw ApiError.forbidden("You do not have access to this subject");
		}

		return subject as SubjectWithRelations;
	}

	/**
	 * Update subject
	 */
	static async updateSubject(
		subjectId: string,
		teacherId: string,
		data: UpdateSubjectDTO
	) {
		// Verify ownership
		const subject = await prisma.subject.findUnique({
			where: { id: subjectId },
		});

		if (!subject) {
			throw ApiError.notFound("Subject not found");
		}

		if (subject.teacherId !== teacherId) {
			throw ApiError.forbidden("You do not have access to this subject");
		}

		// Update subject
		const updated = await prisma.subject.update({
			where: { id: subjectId },
			data,
			include: {
				teacher: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						employeeId: true,
					},
				},
				batches: {
					include: {
						_count: {
							select: {
								students: true,
								timetableEntries: true,
								attendanceSessions: true,
							},
						},
					},
				},
			},
		});

		logger.info(`Subject updated: ${subjectId}`);

		return updated;
	}

	/**
	 * Delete subject (and all related data)
	 */
	static async deleteSubject(subjectId: string, teacherId: string) {
		// Verify ownership
		const subject = await prisma.subject.findUnique({
			where: { id: subjectId },
			include: {
				batches: {
					include: {
						_count: {
							select: { students: true },
						},
					},
				},
			},
		});

		if (!subject) {
			throw ApiError.notFound("Subject not found");
		}

		if (subject.teacherId !== teacherId) {
			throw ApiError.forbidden("You do not have access to this subject");
		}

		// Check if any batches have students
		const totalStudents = subject.batches.reduce(
			(sum, batch) => sum + batch._count.students,
			0
		);

		if (totalStudents > 0) {
			throw ApiError.badRequest(
				`Cannot delete subject with ${totalStudents} enrolled students. Please remove students first.`
			);
		}

		// Delete subject (cascades to batches, timetables, sessions)
		await prisma.subject.delete({
			where: { id: subjectId },
		});

		logger.info(`Subject deleted: ${subjectId}`);

		return { message: "Subject deleted successfully" };
	}

	/**
	 * Get subject statistics
	 */
	static async getSubjectStats(subjectId: string, teacherId: string) {
		const subject = await this.getSubjectById(subjectId, teacherId);

		const stats = {
			totalBatches: subject.batches.length,
			totalStudents: subject.batches.reduce(
				(sum, batch) => sum + batch._count.students,
				0
			),
			totalSessions: subject.batches.reduce(
				(sum, batch) => sum + batch._count.attendanceSessions,
				0
			),
			batches: subject.batches.map((batch) => ({
				id: batch.id,
				name: batch.name,
				code: batch.code,
				students: batch._count.students,
				sessions: batch._count.attendanceSessions,
				capacity: batch.capacity,
				utilization: batch.capacity
					? ((batch._count.students / batch.capacity) * 100).toFixed(
							1
					  )
					: null,
			})),
		};

		return stats;
	}
}
