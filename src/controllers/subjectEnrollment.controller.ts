import type { Request, Response } from "express";
import { SubjectEnrollmentService } from "@services/subjectEnrollment.service";
import { asyncHandler } from "@utils/asyncHandler";
import { ApiError } from "@utils/ApiError";
import type {
	EnrollBatchesDTO,
	SubjectEnrollmentWithBatch,
	UpdateSubjectEnrollmentDTO,
} from "@local-types/models.types";
import prisma from "@/config/database";

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
	 * GET /api/subjects/:subjectId/enrollments
	 * Get all enrollments for a subject
	 * Teachers see only their enrollments, admins see all
	 */
	static async getSubjectEnrollments(
		subjectId: string,
		teacherUserId?: string // Changed from 'teacherUserId: string' to 'teacherUserId?: string'
	): Promise<SubjectEnrollmentWithBatch[]> {
		// Verify subject exists
		const subject = await prisma.subject.findUnique({
			where: { id: subjectId },
		});

		if (!subject) {
			throw ApiError.notFound("Subject not found");
		}

		// Build where clause based on user role
		const whereClause: any = {
			subjectId,
		};

		// If teacher, filter by their userId
		if (teacherUserId) {
			const teacher = await prisma.teacher.findUnique({
				where: { userId: teacherUserId },
			});

			if (!teacher) {
				throw ApiError.notFound("Teacher not found");
			}

			whereClause.teacherId = teacher.id;
		}

		// Fetch enrollments
		const enrollments = await prisma.subjectEnrollment.findMany({
			where: whereClause,
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
				subject: {
					select: {
						id: true,
						code: true,
						name: true,
						department: true,
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
				_count: {
					select: {
						attendanceSessions: true,
					},
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		return enrollments;
	}

	// ...existing code...

	/**
	 * GET /api/batches/:batchId/subjects
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

			const enrollments = await SubjectEnrollmentService.getBatchSubjects(
				batchId // Now TypeScript knows this is definitely a string
			);

			res.json({
				success: true,
				count: enrollments.length,
				data: enrollments,
			});
		}
	);

	/**
	 * GET /api/enrollments/:enrollmentId
	 * Get single enrollment details
	 * Teachers can only view their own enrollments (unless admin)
	 */
	/**
	 * Get enrollment by ID with authorization check
	 */
	static async getEnrollmentById(
		enrollmentId: string,
		teacherUserId?: string // Changed from 'teacherUserId: string' to 'teacherUserId?: string'
	): Promise<SubjectEnrollmentWithBatch> {
		const enrollment = await prisma.subjectEnrollment.findUnique({
			where: { id: enrollmentId },
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
				subject: {
					select: {
						id: true,
						code: true,
						name: true,
						department: true,
						semester: true,
					},
				},
				teacher: {
					select: {
						id: true,
						userId: true,
						employeeId: true,
						firstName: true,
						lastName: true,
					},
				},
				_count: {
					select: {
						attendanceSessions: true,
					},
				},
			},
		});

		if (!enrollment) {
			throw ApiError.notFound("Enrollment not found");
		}

		// Authorization: Teachers can only view their own enrollments
		if (teacherUserId && enrollment.teacher.userId !== teacherUserId) {
			throw ApiError.forbidden("Access denied to this enrollment");
		}

		return enrollment;
	}

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
				enrollmentId, // Now TypeScript knows this is definitely a string
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
	 * Teacher who owns the enrollment or admin
	 */
	static async unenrollBatch(
		enrollmentId: string,
		teacherUserId?: string // Add '?' to make it optional
	): Promise<{ message: string }> {
		// Get enrollment with authorization check
		const enrollment = await this.getEnrollmentById(
			enrollmentId,
			teacherUserId
		);

		// Prevent deletion if there are attendance sessions
		if (enrollment._count && enrollment._count.attendanceSessions > 0) {
			throw ApiError.badRequest(
				"Cannot unenroll batch with existing attendance records"
			);
		}

		// Delete enrollment
		await prisma.subjectEnrollment.delete({
			where: { id: enrollmentId },
		});

		return {
			message: `Batch ${enrollment.batch.code} unenrolled from subject ${enrollment.subject.code}`,
		};
	}
}
