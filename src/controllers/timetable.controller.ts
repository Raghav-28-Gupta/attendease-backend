import type { Request, Response } from "express";
import { TimetableService } from "@services/timetable.service";
import { asyncHandler } from "@utils/asyncHandler";
import { ApiError } from "@utils/ApiError";
import prisma from "@config/database";
import type {
	CreateTimetableEntryDTO,
	UpdateTimetableEntryDTO,
} from "@local-types/models.types";

export class TimetableController {
	/**
	 * POST /api/timetable
	 * Create single timetable entry
	 * Teacher assigns class for subject-batch they teach
	 */
	static createEntry = asyncHandler(async (req: Request, res: Response) => {
		const teacherUserId = req.user!.userId;
		const data: CreateTimetableEntryDTO = req.body;

		const entry = await TimetableService.createTimetableEntry(
			teacherUserId,
			data
		);

		res.status(201).json({
			success: true,
			message: "Timetable entry created successfully",
			data: entry,
		});
	});

	/**
	 * POST /api/batches/:batchId/timetable/bulk
	 * Bulk create timetable entries for batch
	 * Teacher creates multiple entries at once
	 */
	static bulkCreateEntries = asyncHandler(
		async (req: Request, res: Response) => {
			const { batchId } = req.params;
			const teacherUserId = req.user!.userId;
			const { entries } = req.body;

			// Validate batchId exists
			if (!batchId) {
				throw ApiError.badRequest("Batch ID is required");
			}

			// Validate entries array
			if (!Array.isArray(entries) || entries.length === 0) {
				throw ApiError.badRequest(
					"Entries array is required and must not be empty"
				);
			}

			const result = await TimetableService.bulkCreateTimetableEntries(
				batchId,
				teacherUserId,
				entries
			);

			res.status(201).json({
				success: true,
				...result,
			});
		}
	);

	/**
	 * GET /api/batches/:batchId/timetable
	 * Get batch timetable
	 * Public to authenticated users (students need to see their schedule)
	 */
	static getBatchTimetable = asyncHandler(
		async (req: Request, res: Response) => {
			const { batchId } = req.params;

			// Validate batchId exists
			if (!batchId) {
				throw ApiError.badRequest("Batch ID is required");
			}

			const timetable = await TimetableService.getBatchTimetable(batchId);

			res.json({
				success: true,
				count: timetable.length,
				data: timetable,
			});
		}
	);

	/**
	 * GET /api/students/me/timetable
	 * Get logged-in student's timetable (via their batch)
	 * Student-only route
	 */
	static getStudentTimetable = asyncHandler(
		async (req: Request, res: Response) => {
			const userId = req.user!.userId;

			// Get student profile
			const student = await prisma.student.findUnique({
				where: { userId },
				select: {
					id: true,
					batchId: true,
				},
			});

			if (!student) {
				throw ApiError.notFound("Student profile not found");
			}

			const result = await TimetableService.getStudentTimetable(
				student.id
			);

			res.json({
				success: true,
				data: result,
			});
		}
	);

	/**
	 * GET /api/students/me/today
	 * Get today's classes for logged-in student
	 * Student-only route
	 */
	static getTodayClasses = asyncHandler(
		async (req: Request, res: Response) => {
			const userId = req.user!.userId;

			// Get student profile
			const student = await prisma.student.findUnique({
				where: { userId },
				select: {
					id: true,
					batchId: true,
				},
			});

			if (!student) {
				throw ApiError.notFound("Student profile not found");
			}

			const result = await TimetableService.getTodayClasses(student.id);

			res.json({
				success: true,
				count: result.classes.length,
				data: result,
			});
		}
	);

	/**
	 * GET /api/teachers/me/timetable
	 * Get logged-in teacher's timetable
	 * Teacher-only route
	 */
	static getTeacherTimetable = asyncHandler(
		async (req: Request, res: Response) => {
			const userId = req.user!.userId;

			// Get teacher profile
			const teacher = await prisma.teacher.findUnique({
				where: { userId },
				select: {
					id: true,
				},
			});

			if (!teacher) {
				throw ApiError.notFound("Teacher profile not found");
			}

			const result = await TimetableService.getTeacherTimetable(
				teacher.id
			);

			res.json({
				success: true,
				count: result.length,
				data: result,
			});
		}
	);

	/**
	 * PUT /api/timetable/:entryId
	 * Update timetable entry
	 * Teacher who created it or admin
	 */
	static updateEntry = asyncHandler(async (req: Request, res: Response) => {
		const { entryId } = req.params;
		const teacherUserId = req.user!.userId;
		const data: UpdateTimetableEntryDTO = req.body;

		// Validate entryId exists
		if (!entryId) {
			throw ApiError.badRequest("Timetable entry ID is required");
		}

		const entry = await TimetableService.updateTimetableEntry(
			entryId,
			teacherUserId,
			data
		);

		res.json({
			success: true,
			message: "Timetable entry updated successfully",
			data: entry,
		});
	});

	/**
	 * DELETE /api/timetable/:entryId
	 * Delete timetable entry
	 * Teacher who created it or admin
	 */
	static deleteEntry = asyncHandler(async (req: Request, res: Response) => {
		const { entryId } = req.params;
		const teacherUserId = req.user!.userId;

		// Validate entryId exists
		if (!entryId) {
			throw ApiError.badRequest("Timetable entry ID is required");
		}

		const result = await TimetableService.deleteTimetableEntry(
			entryId,
			teacherUserId
		);

		res.json({
			success: true,
			...result,
		});
	});
}
