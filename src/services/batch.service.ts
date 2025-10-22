import prisma from "@config/database";
import { ApiError } from "@utils/ApiError";
import logger from "@utils/logger";
import type {
	CreateBatchDTO,
	UpdateBatchDTO,
	BatchWithRelations,
} from "@local-types/models.types";

export class BatchService {
	/**
	 * Create new batch for existing subject
	 */
	static async createBatch(
		teacherId: string,
		data: CreateBatchDTO
	): Promise<BatchWithRelations> {
		// Verify teacher owns the subject
		const subject = await prisma.subject.findUnique({
			where: { id: data.subjectId },
		});

		if (!subject) {
			throw ApiError.notFound("Subject not found");
		}

		if (subject.teacherId !== teacherId) {
			throw ApiError.forbidden("You do not have access to this subject");
		}

		// Generate batch code
		const batchCode = `${subject.code}-${data.name.toUpperCase().replace(/\s+/g, "")}`;

		// Check if batch code exists
		const existingBatch = await prisma.batch.findUnique({
			where: { code: batchCode },
		});

		if (existingBatch) {
			throw ApiError.badRequest(`Batch code ${batchCode} already exists`);
		}

		// Create batch
		const batch = await prisma.batch.create({
			data: {
				subjectId: data.subjectId,
				name: data.name,
				code: batchCode,
				capacity: data.capacity,
				room: data.room,
			},
			include: {
				subject: true,
				students: true,
				timetableEntries: true,
			},
		});

		logger.info(`Batch created: ${batchCode}`);

		return batch;
	}

	/**
	 * Get batch details with students
	 */
	static async getBatchById(
		batchId: string,
		teacherId?: string
	): Promise<BatchWithRelations> {
		const batch = await prisma.batch.findUnique({
			where: { id: batchId },
			include: {
				subject: {
					include: {
						teacher: true,
					},
				},
				students: {
					orderBy: { studentId: "asc" },
				},
				timetableEntries: {
					orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
				},
			},
		});

		if (!batch) {
			throw ApiError.notFound("Batch not found");
		}

		// Verify ownership if teacherId provided
		if (teacherId && batch.subject.teacherId !== teacherId) {
			throw ApiError.forbidden("You do not have access to this batch");
		}

		return batch as BatchWithRelations;
	}

	/**
	 * Get all batches for a subject
	 */
	static async getSubjectBatches(subjectId: string, teacherId: string) {
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

		const batches = await prisma.batch.findMany({
			where: { subjectId },
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
		});

		return batches;
	}

	/**
	 * Update batch
	 */
	static async updateBatch(
		batchId: string,
		teacherId: string,
		data: UpdateBatchDTO
	) {
		const batch = await this.getBatchById(batchId, teacherId);

		// If name is changing, regenerate code
		let updateData: any = { ...data };

		if (data.name && data.name !== batch.name) {
			const newCode = `${batch.subject.code}-${data.name
				.toUpperCase()
				.replace(/\s+/g, "")}`;

			// Check if new code exists
			const existing = await prisma.batch.findUnique({
				where: { code: newCode },
			});

			if (existing && existing.id !== batchId) {
				throw ApiError.badRequest(
					`Batch code ${newCode} already exists`
				);
			}

			updateData.code = newCode;
		}

		const updated = await prisma.batch.update({
			where: { id: batchId },
			data: updateData,
			include: {
				subject: true,
				_count: {
					select: {
						students: true,
						timetableEntries: true,
						attendanceSessions: true,
					},
				},
			},
		});

		logger.info(`Batch updated: ${batchId}`);

		return updated;
	}

	/**
	 * Delete batch
	 */
	static async deleteBatch(batchId: string, teacherId: string) {
		const batch = await this.getBatchById(batchId, teacherId);

		// Check if batch has students
		if (batch.students.length > 0) {
			throw ApiError.badRequest(
				`Cannot delete batch with ${batch.students.length} students. Please remove students first.`
			);
		}

		await prisma.batch.delete({
			where: { id: batchId },
		});

		logger.info(`Batch deleted: ${batchId}`);

		return { message: "Batch deleted successfully" };
	}

	/**
	 * Get batch students
	 */
	static async getBatchStudents(batchId: string, teacherId: string) {
		const batch = await this.getBatchById(batchId, teacherId);

		return batch.students;
	}
}
