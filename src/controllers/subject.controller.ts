import type { Request, Response } from "express";
import { SubjectService } from "@services/subject.service";
import { asyncHandler } from "@utils/asyncHandler";
import { ApiError } from "@utils/ApiError";
import type {
	CreateSubjectDTO,
	UpdateSubjectDTO,
} from "@local-types/models.types";
import prisma from "@/config/database";
export class SubjectController {
	/**
	 * POST /api/subjects
	 * Create new subject (TEACHER only via middleware)
	 * Subjects are independent - no teacher ownership at creation
	 */
	static createSubject = asyncHandler(async (req: Request, res: Response) => {
		const data: CreateSubjectDTO = req.body;

		// Note: Authorization handled by route middleware (requireRole('TEACHER']))
		const subject = await SubjectService.createSubject(data);

		res.status(201).json({
			success: true,
			message:
				"Subject created successfully. Now enroll batches and assign teachers.",
			data: subject,
		});
	});

	/**
	 * GET /api/subjects
	 * Get all subjects (optionally filter by department)
	 * - TEACHER: All subjects in their institution (for management)
	 * - STUDENT: Only subjects they're enrolled in
	 * - ADMIN: All subjects
	 */
	static getAllSubjects = asyncHandler(async (req: Request, res: Response) => {
		const { department } = req.query;
		const userRole = req.user!.role;
		const userId = req.user!.userId;

		let subjects;

		if (userRole === "TEACHER") {
			// ✅ FIXED: Teachers see ALL subjects (not just ones they teach)
			// This allows them to manage and enroll subjects
			subjects = department
				? await SubjectService.getSubjectsByDepartment(department as string)
				: await SubjectService.getAllSubjects();
		} else if (userRole === "STUDENT") {
			// Students see only subjects their batch is enrolled in
			const student = await prisma.student.findUnique({
				where: { userId },
				include: { batch: true },
			});
			if (!student?.batch) {
				throw ApiError.notFound("You are not assigned to any batch");
			}

			subjects = await SubjectService.getBatchSubjects(student.batch.id);
		} else {
			// Admin sees all subjects
			subjects = department
				? await SubjectService.getSubjectsByDepartment(department as string)
				: await SubjectService.getAllSubjects();
		}

		res.json({
			success: true,
			count: subjects.length,
			data: subjects,
		});
	});

	/**
	 * GET /api/subjects/my-subjects
	 * Get subjects taught by logged-in teacher
	 * Teacher-only route
	 */
	static getTeacherSubjects = asyncHandler(
		async (req: Request, res: Response) => {
			const teacherUserId = req.user!.userId;

			// Verify user is actually a teacher (optional - can be done in middleware)
			if (req.user!.role !== "TEACHER") {
				throw ApiError.forbidden("Only teachers can access this endpoint");
			}

			const subjects = await SubjectService.getTeacherSubjects(
				teacherUserId
			);

			res.json({
				success: true,
				count: subjects.length,
				data: subjects,
			});
		}
	);

	/**
	 * GET /api/subjects/:subjectId
	 * Get subject by ID with all enrollments
	 * Public to authenticated users
	 */
	static getSubjectById = asyncHandler(async (req: Request, res: Response) => {
		const { subjectId } = req.params;

		const subject = await SubjectService.getSubjectById(subjectId!);

		res.json({
			success: true,
			data: subject,
		});
	});

	/**
	 * PUT /api/subjects/:subjectId
	 * Update subject details (TEACHER only via middleware)
	 */
	static updateSubject = asyncHandler(async (req: Request, res: Response) => {
		const { subjectId } = req.params;
		const data: UpdateSubjectDTO = req.body;

		// Note: Authorization handled by route middleware (requireRole(['TEACHER']))
		const subject = await SubjectService.updateSubject(subjectId!, data);

		res.json({
			success: true,
			message: "Subject updated successfully",
			data: subject,
		});
	});

	/**
	 * DELETE /api/subjects/:subjectId
	 * Delete subject (TEACHER only via middleware, only if no enrollments)
	 */
	static deleteSubject = asyncHandler(async (req: Request, res: Response) => {
		const { subjectId } = req.params;

		// Note: Authorization handled by route middleware (requireRole(['TEACHER']))
		const result = await SubjectService.deleteSubject(subjectId!);

		res.json({
			success: true,
			...result,
		});
	});

	/**
	 * GET /api/subjects/:subjectId/stats
	 * Get subject statistics (accessible to anyone who can view the subject)
	 */
	static getSubjectStats = asyncHandler(
		async (req: Request, res: Response) => {
			const { subjectId } = req.params;

			const stats = await SubjectService.getSubjectStats(subjectId!);

			res.json({
				success: true,
				data: stats,
			});
		}
	);

	/**
	 * GET /api/subjects/search?q=CS301
	 * Search subjects by code or name
	 */
	static searchSubjects = asyncHandler(async (req: Request, res: Response) => {
		const { q } = req.query;

		if (!q || typeof q !== "string") {
			throw ApiError.badRequest('Search query parameter "q" is required');
		}

		const subjects = await SubjectService.searchSubjects(q);

		res.json({
			success: true,
			count: subjects.length,
			data: subjects,
		});
	});
}
