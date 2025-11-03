import type { Request, Response } from "express";
import { BatchService } from "@services/batch.service";
import { asyncHandler } from "@utils/asyncHandler";
import type { CreateBatchDTO, UpdateBatchDTO } from "@local-types/models.types";
import { ApiError } from "@/utils/ApiError";

export class BatchController {
	/**
	 * POST /api/batches
	 * Create new batch
	 */
	static createBatch = asyncHandler(async (req: Request, res: Response) => {
		const data: CreateBatchDTO = req.body;

		const batch = await BatchService.createBatch(data);

		res.status(201).json({
			success: true,
			message: "Batch created successfully",
			data: batch,
		});
	});

	/**
	 * GET /api/batches
	 * Get all batches (optionally filter by department)
	 */
	static getAllBatches = asyncHandler(async (req: Request, res: Response) => {
		const { department } = req.query;

		const batches = department
			? await BatchService.getBatchesByDepartment(department as string)
			: await BatchService.getAllBatches();

		res.json({
			success: true,
			count: batches.length,
			data: batches,
		});
	});

	/**
	 * GET /api/batches/:batchId
	 * Get batch with full details
	 */
	static getBatchById = asyncHandler(async (req: Request, res: Response) => {
		const { batchId } = req.params;

		if (!batchId) {
			throw ApiError.badRequest("Batch ID is required");
		}

		const batch = await BatchService.getBatchById(batchId);

		res.json({
			success: true,
			data: batch,
		});
	});

	/**
	 * PUT /api/batches/:batchId
	 * Update batch
	 */
	static updateBatch = asyncHandler(async (req: Request, res: Response) => {
		const { batchId } = req.params;
		const data: UpdateBatchDTO = req.body;
		const userRole = req.user!.role; 
		const userId = req.user!.userId; 

		if (!batchId) {
			throw ApiError.badRequest("Batch ID is required");
		}

		const batch = await BatchService.updateBatch(
			batchId, 
			data,
			// @ts-ignore
			userId
		);

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

		if (!batchId) {
			throw ApiError.badRequest("Batch ID is required");
		}

		const result = await BatchService.deleteBatch(batchId);

		res.json({
			success: true,
			...result,
		});
	});

	/**
	 * GET /api/batches/:batchId/students
	 * Get all students in batch
	 */
	static getBatchStudents = asyncHandler(
		async (req: Request, res: Response) => {
			const { batchId } = req.params;

			if (!batchId) {
				throw ApiError.badRequest("Batch ID is required");
			}

			const students = await BatchService.getBatchStudents(batchId);

			res.json({
				success: true,
				count: students.length,
				data: students,
			});
		}
	);
}
