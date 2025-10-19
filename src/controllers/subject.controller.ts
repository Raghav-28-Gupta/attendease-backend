import type { Request, Response } from "express";
import { SubjectService } from "@services/subject.service";
import { asyncHandler } from "@utils/asyncHandler";
import type { CreateSubjectDTO, UpdateSubjectDTO } from "@local-types/models.types";

export class SubjectController {
	/**
	 * POST /api/subjects
	 * Create new subject with batches
	 */
	static createSubject = asyncHandler(async (req: Request, res: Response) => {
		const teacherId = req.user!.userId;
		const data: CreateSubjectDTO = req.body;

		const subject = await SubjectService.createSubject(teacherId, data);

		res.status(201).json({
			success: true,
			message: "Subject created successfully",
			data: subject,
		});
	});

	/**
	 * GET /api/subjects
	 * Get all subjects for logged-in teacher
	 */
	static getTeacherSubjects = asyncHandler(
		async (req: Request, res: Response) => {
			const teacherId = req.user!.userId;

			const subjects = await SubjectService.getTeacherSubjects(teacherId);

			res.json({
				success: true,
				count: subjects.length,
				data: subjects,
			});
		}
	);

	/**
	 * GET /api/subjects/:subjectId
	 * Get single subject with details
	 */
	static getSubjectById = asyncHandler(
		async (req: Request, res: Response) => {
			const { subjectId } = req.params;
			const teacherId = req.user!.userId;

			const subject = await SubjectService.getSubjectById(
				subjectId!,
				teacherId
			);

			res.json({
				success: true,
				data: subject,
			});
		}
	);

	/**
	 * PUT /api/subjects/:subjectId
	 * Update subject
	 */
	static updateSubject = asyncHandler(async (req: Request, res: Response) => {
		const { subjectId } = req.params;
		const teacherId = req.user!.userId;
		const data: UpdateSubjectDTO = req.body;

		const subject = await SubjectService.updateSubject(
			subjectId!,
			teacherId,
			data
		);

		res.json({
			success: true,
			message: "Subject updated successfully",
			data: subject,
		});
	});

	/**
	 * DELETE /api/subjects/:subjectId
	 * Delete subject
	 */
	static deleteSubject = asyncHandler(async (req: Request, res: Response) => {
		const { subjectId } = req.params;
		const teacherId = req.user!.userId;

		const result = await SubjectService.deleteSubject(subjectId!, teacherId);

		res.json({
			success: true,
			...result,
		});
	});

	/**
	 * GET /api/subjects/:subjectId/stats
	 * Get subject statistics
	 */
	static getSubjectStats = asyncHandler(
		async (req: Request, res: Response) => {
			const { subjectId } = req.params;
			const teacherId = req.user!.userId;

			const stats = await SubjectService.getSubjectStats(
				subjectId!,
				teacherId
			);

			res.json({
				success: true,
				data: stats,
			});
		}
	);
}
