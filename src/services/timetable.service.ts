import prisma from "@config/database";
import { ApiError } from "@utils/ApiError";
import logger from "@utils/logger";
import type {
	CreateTimetableEntryDTO,
	UpdateTimetableEntryDTO,
	TimetableEntryWithDetails,
	BatchTimetableDTO,
} from "@local-types/models.types";

export class TimetableService {
	/**
	 * Create single timetable entry for subject-batch enrollment
	 * Teacher must be assigned to teach this subject-batch via SubjectEnrollment
	 */
	static async createTimetableEntry(
		teacherUserId: string,
		data: CreateTimetableEntryDTO
	): Promise<TimetableEntryWithDetails> {
		// Get teacher record
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		// Verify teacher has a SubjectEnrollment for this batch
		const enrollment = await prisma.subjectEnrollment.findFirst({
			where: {
				id: data.subjectEnrollmentId,
				teacherId: teacher.id,
			},
			include: {
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
					},
				},
				subject: {
					select: {
						id: true,
						code: true,
						name: true,
					},
				},
			},
		});

		if (!enrollment) {
			throw ApiError.forbidden(
				"You are not assigned to teach this subject-batch combination"
			);
		}

		// Check for overlapping entries for the same batch on the same day
		const overlapping = await prisma.timetableEntry.findFirst({
			where: {
				subjectEnrollment: {
					batchId: enrollment.batchId,
				},
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

		// Create timetable entry
		const entry = await prisma.timetableEntry.create({
			data: {
				batchId: enrollment.batchId,
				subjectEnrollmentId: data.subjectEnrollmentId,
				dayOfWeek: data.dayOfWeek,
				startTime: data.startTime,
				endTime: data.endTime,
				classRoom: data.classRoom,
			},
			include: {
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
						department: true,
						year: true,
					},
				},
				subjectEnrollment: {
					select: {
						id: true,
						subject: {
							select: {
								id: true,
								code: true,
								name: true,
								semester: true,
							},
						},
						teacher: {
							select: {
								id: true,
								employeeId: true,
								firstName: true,
								lastName: true,
							},
						},
						room: true,
					},
				},
			},
		});

		logger.info(
			`Timetable entry created: ${enrollment.subject.code} for batch ${enrollment.batch.code} on ${data.dayOfWeek}`
		);

		return entry;
	}

	/**
	 * Bulk create timetable entries for batch
	 * Teacher must be assigned to teach subjects in this batch
	 */
	static async bulkCreateTimetableEntries(
		batchId: string,
		teacherUserId: string,
		entries: BatchTimetableDTO[]
	) {
		// Get teacher record
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		// Verify batch exists
		const batch = await prisma.batch.findUnique({
			where: { id: batchId },
		});

		if (!batch) {
			throw ApiError.notFound("Batch not found");
		}

		// Verify teacher has at least one SubjectEnrollment for this batch
		const enrollments = await prisma.subjectEnrollment.findMany({
			where: {
				batchId,
				teacherId: teacher.id,
			},
		});

		if (enrollments.length === 0) {
			throw ApiError.forbidden(
				"You are not assigned to teach any subjects for this batch"
			);
		}

		// Delete existing timetable entries for this batch
		await prisma.timetableEntry.deleteMany({
			where: {
				subjectEnrollment: {
					batchId,
				},
			},
		});

		// Transform entries to include required fields
		const timetableData = entries.map((entry) => ({
			batchId: batchId,
			subjectEnrollmentId: entry.subjectEnrollmentId, // Must be provided in BatchTimetableDTO
			dayOfWeek: entry.dayOfWeek,
			startTime: entry.startTime,
			endTime: entry.endTime,
			classRoom: entry.classRoom,
		}));

		// Create new entries
		const created = await prisma.timetableEntry.createMany({
			data: timetableData,
		});

		logger.info(
			`Bulk created ${created.count} timetable entries for batch ${batch.code}`
		);

		// Fetch and return created entries
		const timetable = await prisma.timetableEntry.findMany({
			where: {
				subjectEnrollment: {
					batchId,
				},
			},
			include: {
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
						department: true,
						year: true,
					},
				},
				subjectEnrollment: {
					select: {
						id: true,
						subject: {
							select: {
								id: true,
								code: true,
								name: true,
								semester: true,
							},
						},
						teacher: {
							select: {
								id: true,
								employeeId: true,
								firstName: true,
								lastName: true,
							},
						},
						room: true,
					},
				},
			},
			orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
		});

		return {
			message: `${created.count} timetable entries created successfully`,
			count: created.count,
			timetable,
		};
	}

	/**
	 * Get timetable for batch (all subjects taught to this batch)
	 * Public to authenticated users - students need to see their schedule
	 */
	static async getBatchTimetable(
		batchId: string
	): Promise<TimetableEntryWithDetails[]> {
		// Verify batch exists
		const batch = await prisma.batch.findUnique({
			where: { id: batchId },
		});

		if (!batch) {
			throw ApiError.notFound("Batch not found");
		}

		// Fetch all timetable entries for this batch
		const timetable = await prisma.timetableEntry.findMany({
			where: {
				subjectEnrollment: {
					batchId,
				},
			},
			include: {
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
						department: true,
						year: true,
					},
				},
				subjectEnrollment: {
					select: {
						id: true,
						subject: {
							select: {
								id: true,
								code: true,
								name: true,
								semester: true,
							},
						},
						teacher: {
							select: {
								id: true,
								employeeId: true,
								firstName: true,
								lastName: true,
							},
						},
						room: true,
					},
				},
			},
			orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
		});

		return timetable;
	}

	/**
	 * Get student's timetable (via their batch)
	 * Shows all subjects taught to their batch
	 */
	static async getStudentTimetable(studentId: string) {
		const student = await prisma.student.findUnique({
			where: { id: studentId },
			include: {
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
			throw ApiError.notFound("Student not found");
		}

		// Check if student has a batch assigned
		if (!student.batchId) {
			throw ApiError.badRequest(
				"You are not assigned to any batch. Please contact administration."
			);
		}

		// Fetch timetable for student's batch
		const timetable = await prisma.timetableEntry.findMany({
			where: {
				subjectEnrollment: {
					batchId: student.batchId,
				},
			},
			include: {
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
						department: true,
						year: true,
					},
				},
				subjectEnrollment: {
					select: {
						id: true,
						subject: {
							select: {
								id: true,
								code: true,
								name: true,
								semester: true,
							},
						},
						teacher: {
							select: {
								id: true,
								employeeId: true,
								firstName: true,
								lastName: true,
							},
						},
						room: true,
					},
				},
			},
			orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
		});

		return {
			batch: student.batch,
			timetable,
		};
	}

	/**
	 * Get today's classes for student
	 */
	static async getTodayClasses(studentId: string) {
		const today = new Date()
			.toLocaleDateString("en-US", { weekday: "long" })
			.toUpperCase();

		const student = await prisma.student.findUnique({
			where: { id: studentId },
			include: {
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
			throw ApiError.notFound("Student not found");
		}

		if (!student.batchId) {
			throw ApiError.badRequest(
				"You are not assigned to any batch. Please contact administration."
			);
		}

		// Fetch today's classes
		const classes = await prisma.timetableEntry.findMany({
			where: {
				subjectEnrollment: {
					batchId: student.batchId,
				},
				dayOfWeek: today,
			},
			include: {
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
						department: true,
						year: true,
					},
				},
				subjectEnrollment: {
					select: {
						id: true,
						subject: {
							select: {
								id: true,
								code: true,
								name: true,
								semester: true,
							},
						},
						teacher: {
							select: {
								id: true,
								employeeId: true,
								firstName: true,
								lastName: true,
							},
						},
						room: true,
					},
				},
			},
			orderBy: { startTime: "asc" },
		});

		return {
			day: today,
			batch: student.batch,
			classes,
		};
	}

	/**
	 * Get teacher's timetable (all their scheduled classes)
	 * Query via SubjectEnrollment since teachers are assigned there
	 */
	static async getTeacherTimetable(
		teacherId: string
	): Promise<TimetableEntryWithDetails[]> {
		// Fetch all timetable entries for batches where teacher has enrollments
		const entries = await prisma.timetableEntry.findMany({
			where: {
				subjectEnrollment: {
					teacherId: teacherId, // Teacher assigned to this subject-batch enrollment
				},
			},
			include: {
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
						department: true,
						year: true,
					},
				},
				subjectEnrollment: {
					select: {
						id: true,
						subject: {
							select: {
								id: true,
								code: true,
								name: true,
								semester: true,
							},
						},
						teacher: {
							select: {
								id: true,
								employeeId: true,
								firstName: true,
								lastName: true,
							},
						},
						room: true,
					},
				},
			},
			orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
		});

		return entries;
	}

	/**
	 * Update timetable entry
	 * Teacher who created it (via enrollment) or admin
	 */
	static async updateTimetableEntry(
		entryId: string,
		teacherUserId: string,
		data: UpdateTimetableEntryDTO
	): Promise<TimetableEntryWithDetails> {
		// Get teacher record
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		// Fetch entry with authorization check
		const entry = await prisma.timetableEntry.findUnique({
			where: { id: entryId },
			include: {
				subjectEnrollment: {
					select: {
						id: true,
						teacherId: true,
						batchId: true,
					},
				},
			},
		});

		if (!entry) {
			throw ApiError.notFound("Timetable entry not found");
		}

		// Verify teacher owns this enrollment
		if (entry.subjectEnrollment.teacherId !== teacher.id) {
			throw ApiError.forbidden(
				"You do not have access to update this timetable entry"
			);
		}

		// Check for overlapping if time/day is being changed
		if (data.startTime || data.endTime || data.dayOfWeek) {
			const overlapping = await prisma.timetableEntry.findFirst({
				where: {
					id: { not: entryId },
					subjectEnrollment: {
						batchId: entry.subjectEnrollment.batchId,
					},
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

		// Update entry
		const updated = await prisma.timetableEntry.update({
			where: { id: entryId },
			data: {
				dayOfWeek: data.dayOfWeek,
				startTime: data.startTime,
				endTime: data.endTime,
				classRoom: data.classRoom,
			},
			include: {
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
						department: true,
						year: true,
					},
				},
				subjectEnrollment: {
					select: {
						id: true,
						subject: {
							select: {
								id: true,
								code: true,
								name: true,
								semester: true,
							},
						},
						teacher: {
							select: {
								id: true,
								employeeId: true,
								firstName: true,
								lastName: true,
							},
						},
						room: true,
					},
				},
			},
		});

		logger.info(`Timetable entry updated: ${entryId}`);

		return updated;
	}

	/**
	 * Delete timetable entry
	 * Teacher who created it (via enrollment) or admin
	 */
	static async deleteTimetableEntry(
		entryId: string,
		teacherUserId: string
	): Promise<{ message: string }> {
		// Get teacher record
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		// Fetch entry with authorization check
		const entry = await prisma.timetableEntry.findUnique({
			where: { id: entryId },
			include: {
				subjectEnrollment: {
					select: {
						teacherId: true,
					},
				},
			},
		});

		if (!entry) {
			throw ApiError.notFound("Timetable entry not found");
		}

		// Verify teacher owns this enrollment
		if (entry.subjectEnrollment.teacherId !== teacher.id) {
			throw ApiError.forbidden(
				"You do not have access to delete this timetable entry"
			);
		}

		// Delete entry
		await prisma.timetableEntry.delete({
			where: { id: entryId },
		});

		logger.info(`Timetable entry deleted: ${entryId}`);

		return { message: "Timetable entry deleted successfully" };
	}
}
