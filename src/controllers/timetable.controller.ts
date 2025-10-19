import type { Request, Response } from "express";
import { TimetableService } from "@services/timetable.service";
import { asyncHandler } from "@utils/asyncHandler";
import prisma from "@/config/database";
import { ApiError } from "@/utils/ApiError";

export class TimetableController {
	/**
	 * POST /api/timetable
	 * Create single timetable entry
	 */
	static createEntry = asyncHandler(async (req: Request, res: Response) => {
		const teacherId = req.user!.userId;

		const entry = await TimetableService.createTimetableEntry(
			teacherId,
			req.body
		);

		res.status(201).json({
			success: true,
			message: "Timetable entry created",
			data: entry,
		});
	});

	/**
	 * POST /api/batches/:batchId/timetable/bulk
	 * Bulk create timetable entries
	 */
	static bulkCreateEntries = asyncHandler(
		async (req: Request, res: Response) => {
			const { batchId } = req.params;
			const teacherId = req.user!.userId;
			const { entries } = req.body;

			const result = await TimetableService.bulkCreateTimetableEntries(
				batchId!,
				teacherId,
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
	 */
	static getBatchTimetable = asyncHandler(
		async (req: Request, res: Response) => {
			const { batchId } = req.params;
			const teacherId = req.user!.userId;

			const timetable = await TimetableService.getBatchTimetable(
				batchId!,
				teacherId
			);

			res.json({
				success: true,
				count: timetable.length,
				data: timetable,
			});
		}
	);

	/**
	 * GET /api/students/me/timetable
	 * Get student's timetable
	 */
	static getStudentTimetable = asyncHandler(
		async (req: Request, res: Response) => {
			const userId = req.user!.userId;

			// Get student from userId
			const student = await prisma.student.findUnique({
				where: { userId },
			});

			if (!student) {
				throw ApiError.notFound("Student not found");
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
	 * Get today's classes for student
	 */
	static getTodayClasses = asyncHandler(
		async (req: Request, res: Response) => {
			const userId = req.user!.userId;

			const student = await prisma.student.findUnique({
				where: { userId },
			});

			if (!student) {
				throw ApiError.notFound("Student not found");
			}

			const result = await TimetableService.getTodayClasses(student.id);

			res.json({
				success: true,
				data: result,
			});
		}
	);

	/**
	 * PUT /api/timetable/:entryId
	 * Update timetable entry
	 */
	static updateEntry = asyncHandler(async (req: Request, res: Response) => {
		const { entryId } = req.params;
		const teacherId = req.user!.userId;

		const entry = await TimetableService.updateTimetableEntry(
			entryId!,
			teacherId,
			req.body
		);

		res.json({
			success: true,
			message: "Timetable entry updated",
			data: entry,
		});
	});

	/**
	 * DELETE /api/timetable/:entryId
	 * Delete timetable entry
	 */
	static deleteEntry = asyncHandler(async (req: Request, res: Response) => {
		const { entryId } = req.params;
		const teacherId = req.user!.userId;

		const result = await TimetableService.deleteTimetableEntry(
			entryId!,
			teacherId
		);

		res.json({
			success: true,
			...result,
		});
	});
}
