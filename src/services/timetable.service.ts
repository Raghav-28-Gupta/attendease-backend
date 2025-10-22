import prisma from "@config/database";
import { ApiError } from "@utils/ApiError";
import logger from "@utils/logger";
import type {
	CreateTimetableEntryDTO,
	TimetableEntryWithBatch,
	BatchTimetableDTO,
} from "@local-types/models.types";

export class TimetableService {
	/**
	 * Create single timetable entry for batch
	 */
	static async createTimetableEntry(
		teacherId: string,
		data: CreateTimetableEntryDTO
	): Promise<TimetableEntryWithBatch> {
		// Verify teacher owns the batch
		const batch = await prisma.batch.findUnique({
			where: { id: data.batchId },
			include: {
				subject: { include: { teacher: true } },
			},
		});

		if (!batch) {
			throw ApiError.notFound("Batch not found");
		}

		if (batch.subject.teacher.userId !== teacherId) {
			throw ApiError.forbidden("You do not have access to this batch");
		}

		// Check for overlapping entries
		const overlapping = await prisma.timetableEntry.findFirst({
			where: {
				batchId: data.batchId,
				dayOfWeek: data.dayOfWeek,
				OR: [
					{
						AND: [
							{ startTime: { lte: data.startTime } },
							{ endTime: { gt: data.startTime } },
						],
					},
					{
						AND: [
							{ startTime: { lt: data.endTime } },
							{ endTime: { gte: data.endTime } },
						],
					},
				],
			},
		});

		if (overlapping) {
			throw ApiError.badRequest(
				`Time slot overlaps with existing entry on ${data.dayOfWeek}`
			);
		}

		// Create entry
		const entry = await prisma.timetableEntry.create({
			data,
			include: {
				batch: {
					include: {
						subject: true,
					},
				},
			},
		});

		logger.info(`Timetable entry created for batch ${batch.code}`);

		return entry as TimetableEntryWithBatch;
	}

	/**
	 * Bulk create timetable entries for batch
	 */
	static async bulkCreateTimetableEntries(
		batchId: string,
		teacherId: string,
		entries: BatchTimetableDTO[]
	) {
		// Verify teacher owns the batch
		const batch = await prisma.batch.findUnique({
			where: { id: batchId },
			include: {
				subject: { include: { teacher: true } },
			},
		});

		if (!batch) {
			throw ApiError.notFound("Batch not found");
		}

		if (batch.subject.teacher.userId !== teacherId) {
			throw ApiError.forbidden("You do not have access to this batch");
		}

		// Delete existing timetable entries
		await prisma.timetableEntry.deleteMany({
			where: { batchId },
		});

		// Create new entries
		const created = await prisma.timetableEntry.createMany({
			data: entries.map((entry) => ({
				batchId,
				...entry,
			})),
		});

		logger.info(
			`Bulk created ${created.count} timetable entries for batch ${batch.code}`
		);

		// Fetch and return created entries
		const timetable = await this.getBatchTimetable(batchId, teacherId);

		return {
			message: `${created.count} timetable entries created`,
			timetable,
		};
	}

	/**
	 * Get timetable for batch
	 */
	static async getBatchTimetable(batchId: string, teacherId?: string) {
		const batch = await prisma.batch.findUnique({
			where: { id: batchId },
			include: {
				subject: { include: { teacher: true } },
			},
		});

		if (!batch) {
			throw ApiError.notFound("Batch not found");
		}

		if (teacherId && batch.subject.teacher.userId !== teacherId) {
			throw ApiError.forbidden("You do not have access to this batch");
		}

		const timetable = await prisma.timetableEntry.findMany({
			where: { batchId },
			include: {
				batch: {
					include: {
						subject: true,
					},
				},
			},
			orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
		});

		return timetable;
	}

	/**
	 * Get student's timetable (via their batch)
	 */
	static async getStudentTimetable(studentId: string) {
		const student = await prisma.student.findUnique({
			where: { id: studentId },
			include: {
				batch: {
					include: {
						subject: true,
						timetableEntries: {
							orderBy: [
								{ dayOfWeek: "asc" },
								{ startTime: "asc" },
							],
						},
					},
				},
			},
		});

		if (!student) {
			throw ApiError.notFound("Student not found");
		}

		// Check if student has a batch assigned
		if (!student.batch) {
			throw ApiError.badRequest(
				"Student is not assigned to any batch. Please contact your teacher."
			);
		}

		return {
			batch: {
				id: student.batch.id,
				name: student.batch.name,
				code: student.batch.code,
				subject: {
					name: student.batch.subject.name,
					code: student.batch.subject.code,
				},
			},
			timetable: student.batch.timetableEntries,
		};
	}

	/**
	 * Update timetable entry
	 */
	static async updateTimetableEntry(
		entryId: string,
		teacherId: string,
		data: Partial<CreateTimetableEntryDTO>
	) {
		const entry = await prisma.timetableEntry.findUnique({
			where: { id: entryId },
			include: {
				batch: {
					include: {
						subject: { include: { teacher: true } },
					},
				},
			},
		});

		if (!entry) {
			throw ApiError.notFound("Timetable entry not found");
		}

		if (entry.batch.subject.teacher.userId !== teacherId) {
			throw ApiError.forbidden("You do not have access to this entry");
		}

		// Check for overlapping if time is being changed
		if (data.startTime || data.endTime || data.dayOfWeek) {
			const overlapping = await prisma.timetableEntry.findFirst({
				where: {
					id: { not: entryId },
					batchId: entry.batchId,
					dayOfWeek: data.dayOfWeek || entry.dayOfWeek,
					OR: [
						{
							AND: [
								{
									startTime: {
										lte: data.startTime || entry.startTime,
									},
								},
								{
									endTime: {
										gt: data.startTime || entry.startTime,
									},
								},
							],
						},
						{
							AND: [
								{
									startTime: {
										lt: data.endTime || entry.endTime,
									},
								},
								{
									endTime: {
										gte: data.endTime || entry.endTime,
									},
								},
							],
						},
					],
				},
			});

			if (overlapping) {
				throw ApiError.badRequest(
					"Time slot overlaps with existing entry"
				);
			}
		}

		const updated = await prisma.timetableEntry.update({
			where: { id: entryId },
			data,
			include: {
				batch: {
					include: {
						subject: true,
					},
				},
			},
		});

		logger.info(`Timetable entry updated: ${entryId}`);

		return updated;
	}

	/**
	 * Delete timetable entry
	 */
	static async deleteTimetableEntry(entryId: string, teacherId: string) {
		const entry = await prisma.timetableEntry.findUnique({
			where: { id: entryId },
			include: {
				batch: {
					include: {
						subject: { include: { teacher: true } },
					},
				},
			},
		});

		if (!entry) {
			throw ApiError.notFound("Timetable entry not found");
		}

		if (entry.batch.subject.teacher.userId !== teacherId) {
			throw ApiError.forbidden("You do not have access to this entry");
		}

		await prisma.timetableEntry.delete({
			where: { id: entryId },
		});

		logger.info(`Timetable entry deleted: ${entryId}`);

		return { message: "Timetable entry deleted successfully" };
	}

	/**
	 * Get today's classes for student
	 */
	static async getTodayClasses(studentId: string) {
		const today = new Date()
			.toLocaleDateString("en-US", { weekday: "long" })
			.toUpperCase();  // assuming DB stores day of the week in uppercase

		const student = await prisma.student.findUnique({
			where: { id: studentId },
			include: {
				batch: {
					include: {
						subject: true,
						timetableEntries: {
							where: { dayOfWeek: today },
							orderBy: { startTime: "asc" },
						},
					},
				},
			},
		});

		if (!student) {
			throw ApiError.notFound("Student not found");
		}

		// Check if student has a batch assigned
		if (!student.batch) {
			throw ApiError.badRequest(
				"Student is not assigned to any batch. Please contact your teacher."
			);
		}

		return {
			day: today,
			batch: {
				name: student.batch.name,
				subject: student.batch.subject.name,
			},
			classes: student.batch.timetableEntries,
		};
	}
}
