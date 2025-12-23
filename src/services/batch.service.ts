import prisma from "@config/database";
import { ApiError } from "@utils/ApiError";
import logger from "@utils/logger";
import type {
	CreateBatchDTO,
	BatchWithStudents,
} from "@local-types/models.types";

export class BatchService {
	/**
	 * Create new batch (student division)
	 */
	static async createBatch(data: CreateBatchDTO): Promise<BatchWithStudents> {
		// Check if batch code already exists
		const existing = await prisma.batch.findUnique({
			where: { code: data.code },
		});

		if (existing) {
			throw ApiError.badRequest(`Batch code ${data.code} already exists`);
		}

		const batch = await prisma.batch.create({
			data,
			include: {
				students: true,
				_count: {
					select: {
						students: true,
						subjectEnrollments: true,
					},
				},
			},
		});

		logger.info(`Batch created: ${data.code}`);

		return {
			...batch,
			academicYear: batch.year, // Map 'year' to 'academicYear'
			studentCount: batch._count.students,
		} as any;
	}

	/**
	 * ✅ Get batches for a specific teacher (only batches they teach)
	 */
	static async getTeacherBatches(teacherUserId: string) {
		// Get teacher record
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		// Get batches where teacher has active enrollments
		const batches = await prisma.batch.findMany({
			where: {
				subjectEnrollments: {
					some: {
						teacherId: teacher.id,
						status: "ACTIVE",
					},
				},
			},
			include: {
				_count: {
					select: {
						students: true,
						subjectEnrollments: true,
					},
				},
			},
			orderBy: { code: "asc" },
		});

		return batches.map((batch) => ({
			...batch,
			academicYear: batch.year,
			studentCount: batch._count.students,
		}));
	}

	/**
	 * Get all batches
	 */
	static async getAllBatches() {
		const batches = await prisma.batch.findMany({
			include: {
				_count: {
					select: {
						students: true,
						subjectEnrollments: true,
					},
				},
			},
			orderBy: { code: "asc" },
		});

		return batches.map((batch) => ({
			...batch,
			academicYear: batch.year,
			studentCount: batch._count.students,
		}));
	}

	/**
	 * Get batch by ID with full details
	 */
	static async getBatchById(batchId: string): Promise<BatchWithStudents> {
		const batch = await prisma.batch.findUnique({
			where: { id: batchId },
			include: {
				students: {
					orderBy: { studentId: "asc" },
				},
				subjectEnrollments: {
					include: {
						subject: true, // Just the subject, no nested teacher
						batch: true, // Include batch
						teacher: {
							// Teacher from enrollment
							select: {
								id: true,
								firstName: true,
								lastName: true,
								employeeId: true,
								department: true,
							},
						},
					},
				},
				_count: {
					select: {
						students: true,
						subjectEnrollments: true,
					},
				},
			},
		});

		if (!batch) {
			throw ApiError.notFound("Batch not found");
		}

		return {
			...batch,
			academicYear: batch.year,
			studentCount: batch._count.students,
		} as any;
	}

	/**
	 * Update batch
	 */
	static async updateBatch(batchId: string, data: Partial<CreateBatchDTO>) {
		const batch = await prisma.batch.findUnique({
			where: { id: batchId },
		});

		if (!batch) {
			throw ApiError.notFound("Batch not found");
		}

		// If code is changing, check for duplicates
		if (data.code && data.code !== batch.code) {
			const existing = await prisma.batch.findUnique({
				where: { code: data.code },
			});

			if (existing) {
				throw ApiError.badRequest(`Batch code ${data.code} already exists`);
			}
		}

		const updated = await prisma.batch.update({
			where: { id: batchId },
			data,
			include: {
				_count: {
					select: {
						students: true,
						subjectEnrollments: true,
					},
				},
			},
		});

		logger.info(`Batch updated: ${batchId}`);

		return {
			...updated,
			academicYear: updated.year,
			studentCount: updated._count.students,
		};
	}

	/**
	 * Delete batch
	 */
	static async deleteBatch(batchId: string) {
		const batch = await this.getBatchById(batchId);

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
	static async getBatchStudents(batchId: string) {
		const batch = await this.getBatchById(batchId);
		return batch.students;
	}

	/**
	 * Get batches by department
	 */
	static async getBatchesByDepartment(department: string) {
		const batches = await prisma.batch.findMany({
			where: { department },
			include: {
				_count: {
					select: {
						students: true,
						subjectEnrollments: true,
					},
				},
			},
			orderBy: { code: "asc" },
		});

		return batches;
	}
}
