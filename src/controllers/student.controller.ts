import type { Request, Response } from "express";
import { StudentService } from "@services/student.service";
import { asyncHandler } from "@utils/asyncHandler";
import { ApiError } from "@utils/ApiError";
import type { UpdateStudentProfileDTO } from "@local-types/models.types";

export class StudentController {
	/**
	 * GET /api/students/me
	 * Get logged-in student's profile
	 */
	static getMyProfile = asyncHandler(async (req: Request, res: Response) => {
		const userId = req.user!.userId;

		const student = await StudentService.getStudentByUserId(userId);

		res.json({
			success: true,
			data: student,
		});
	});

	/**
	 * PUT /api/students/me
	 * Update student profile
	 */
	static updateMyProfile = asyncHandler(
		async (req: Request, res: Response) => {
			const userId = req.user!.userId;
			const data: UpdateStudentProfileDTO = req.body; // can only update firstname, lastname or ph no.

			const student = await StudentService.updateStudentProfile(userId, data);

			res.json({
				success: true,
				message: "Profile updated successfully",
				data: student,
			});
		}
	);

	/**
	 * GET /api/students/me/batch
	 * Get student's batch with enrolled subjects
	 */
	static getMyBatch = asyncHandler(async (req: Request, res: Response) => {
		const userId = req.user!.userId;

		const batchDetails = await StudentService.getStudentBatch(userId);

		res.json({
			success: true,
			data: batchDetails,
		});
	});

	 /**
     * GET /api/students/:studentId
     * Get student details by ID (with attendance stats)
     * Teacher-only route
     */
	static getStudentById = asyncHandler(async (req: Request, res: Response) => {
		const { studentId } = req.params;

		if (!studentId) {
			throw ApiError.badRequest("Student ID is required");
		}

		const student = await StudentService.getStudentById(studentId);

		res.json({
			success: true,
			data: student,
		});
	});
}
