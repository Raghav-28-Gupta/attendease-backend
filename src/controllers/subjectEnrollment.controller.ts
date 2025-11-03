import type { Request, Response } from "express";
import { SubjectEnrollmentService } from "@services/subjectEnrollment.service";
import { asyncHandler } from "@utils/asyncHandler";
import { ApiError } from "@utils/ApiError";
import type {
	EnrollBatchesDTO,
	UpdateSubjectEnrollmentDTO,
} from "@local-types/models.types";

export class SubjectEnrollmentController {
	/**
	 * POST /api/enrollments
	 * Enroll batches to subject (teacher assigns themselves to teach)
	 * Teacher-only route
	 */
	static enrollBatches = asyncHandler(async (req: Request, res: Response) => {
		const teacherUserId = req.user!.userId;
		const data: EnrollBatchesDTO = req.body;

		const result = await SubjectEnrollmentService.enrollBatchesToSubject(
			teacherUserId,
			data
		);

		res.status(201).json({
			success: true,
			...result,
		});
	});

	/**
	 * GET /api/enrollments/subjects/:subjectId
	 * Get all batch enrollments for a subject
	 * Teachers see only their enrollments, admins see all
	 */
	static getSubjectEnrollments = asyncHandler(
		async (req: Request, res: Response) => {
			const { subjectId } = req.params;

			// Validate subjectId exists
			if (!subjectId) {
				throw ApiError.badRequest("Subject ID is required");
			}

			// Admins can view all enrollments, teachers only their own
			const teacherUserId = req.user!.role === "TEACHER" ? req.user!.userId : undefined;

			const enrollments = await SubjectEnrollmentService.getSubjectEnrollments(
					subjectId,
					teacherUserId
				);

			res.json({
				success: true,
				count: enrollments.length,
				data: enrollments,
			});
		}
	);

	/**
	 * GET /api/enrollments/batches/:batchId/subjects
	 * Get all subjects a batch is enrolled in (with teacher info)
	 * Public to authenticated users
	 */
	static getBatchSubjects = asyncHandler(
		async (req: Request, res: Response) => {
			const { batchId } = req.params;

			// Validate batchId exists
			if (!batchId) {
				throw ApiError.badRequest("Batch ID is required");
			}

			const enrollments = await SubjectEnrollmentService.getBatchSubjects(batchId);

			res.json({
				success: true,
				count: enrollments.length,
				data: enrollments,
			});
		}
	);

	/**
	 * GET /api/enrollments/:enrollmentId
	 * Get specific enrollment details
	 * Teachers see only their enrollments, admins see all
	 */
	static getEnrollmentById = asyncHandler(
		async (req: Request, res: Response) => {
			const { enrollmentId } = req.params;

			// Validate enrollmentId exists
			if (!enrollmentId) {
				throw ApiError.badRequest("Enrollment ID is required");
			}

			// Admins can view any enrollment, teachers only their own
			const teacherUserId = req.user!.role === "TEACHER" ? req.user!.userId : undefined;

			const enrollment = await SubjectEnrollmentService.getEnrollmentById(
				enrollmentId,
				teacherUserId
			);

			res.json({
				success: true,
				data: enrollment,
			});
		}
	);

	/**
	 * PUT /api/enrollments/:enrollmentId
	 * Update enrollment (change teacher, room, status, etc.)
	 * Teacher who owns the enrollment or admin
	 */
	static updateEnrollment = asyncHandler(
		async (req: Request, res: Response) => {
			const { enrollmentId } = req.params;
			const data: UpdateSubjectEnrollmentDTO = req.body;

			// Validate enrollmentId exists
			if (!enrollmentId) {
				throw ApiError.badRequest("Enrollment ID is required");
			}

			// Admins can update any enrollment, teachers only their own
			const teacherUserId =
				req.user!.role === "TEACHER" ? req.user!.userId : undefined;

			const enrollment = await SubjectEnrollmentService.updateEnrollment(
				enrollmentId,
				teacherUserId,
				data
			);

			res.json({
				success: true,
				message: "Enrollment updated successfully",
				data: enrollment,
			});
		}
	);

	/**
	 * DELETE /api/enrollments/:enrollmentId
	 * Unenroll batch from subject (remove enrollment)
	 * Teacher who owns the enrollment
	 */
	static unenrollBatch = asyncHandler(async (req: Request, res: Response) => {
		const { enrollmentId } = req.params;
		const teacherUserId = req.user!.userId;

		// Validate enrollmentId exists
		if (!enrollmentId) {
			throw ApiError.badRequest("Enrollment ID is required");
		}
          
		const result = await SubjectEnrollmentService.unenrollBatch(
			enrollmentId,
			teacherUserId!
		);

		res.json({
			success: true,
			...result,
		});
	});
}
