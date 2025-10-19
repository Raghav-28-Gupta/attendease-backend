import type { Request, Response } from "express";
import { BatchService } from "@services/batch.service";
import { asyncHandler } from "@utils/asyncHandler";
import type { CreateBatchDTO, UpdateBatchDTO } from "@local-types/models.types";

export class BatchController {
	/**
	 * POST /api/batches
	 * Create new batch for existing subject
	 */
	static createBatch = asyncHandler(async (req: Request, res: Response) => {
		const teacherId = req.user!.userId;
		const data: CreateBatchDTO = req.body;

		const batch = await BatchService.createBatch(teacherId, data);

		res.status(201).json({
			success: true,
			message: "Batch created successfully",
			data: batch,
		});
	});

	/**
	 * GET /api/batches/:batchId
	 * Get batch details with students
	 */
	static getBatchById = asyncHandler(async (req: Request, res: Response) => {
		const { batchId } = req.params;
		const teacherId = req.user!.userId;

		const batch = await BatchService.getBatchById(batchId!, teacherId);

		res.json({
			success: true,
			data: batch,
		});
	});

	/**
	 * GET /api/subjects/:subjectId/batches
	 * Get all batches for a subject
	 */
	static getSubjectBatches = asyncHandler(
		async (req: Request, res: Response) => {
			const { subjectId } = req.params;
			const teacherId = req.user!.userId;

			const batches = await BatchService.getSubjectBatches(
				subjectId!,
				teacherId
			);

			res.json({
				success: true,
				count: batches.length,
				data: batches,
			});
		}
	);

	/**
	 * PUT /api/batches/:batchId
	 * Update batch
	 */
	static updateBatch = asyncHandler(async (req: Request, res: Response) => {
		const { batchId } = req.params;
		const teacherId = req.user!.userId;
		const data: UpdateBatchDTO = req.body;

		const batch = await BatchService.updateBatch(batchId!, teacherId, data);

		res.json({
			success: true,
			message: "Batch updated successfully",
			data: batch,
		});
	});

	/**
	 * DELETE /api/batches/:batchId
	 * Delete batch
	 */
	static deleteBatch = asyncHandler(async (req: Request, res: Response) => {
		const { batchId } = req.params;
		const teacherId = req.user!.userId;

		const result = await BatchService.deleteBatch(batchId!, teacherId);

		res.json({
			success: true,
			...result,
		});
	});

	/**
	 * GET /api/batches/:batchId/students
	 * Get all students in a batch
	 */
	static getBatchStudents = asyncHandler(
		async (req: Request, res: Response) => {
			const { batchId } = req.params;
			const teacherId = req.user!.userId;

			const students = await BatchService.getBatchStudents(
				batchId!,
				teacherId
			);

			res.json({
				success: true,
				count: students.length,
				data: students,
			});
		}
	);
}
