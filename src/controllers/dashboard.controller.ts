import type { Request, Response } from "express";
import { DashboardService } from "@services/dashboard.service";
import { asyncHandler } from "@utils/asyncHandler";

export class DashboardController {
	/**
	 * GET /api/dashboard/teacher
	 * Get teacher dashboard data
	 */
	static getTeacherDashboard = asyncHandler(
		async (req: Request, res: Response) => {
			const teacherUserId = req.user!.userId;

			const data = await DashboardService.getTeacherDashboard(
				teacherUserId
			);

			res.json({
				success: true,
				data,
			});
		}
	);

	/**
	 * GET /api/dashboard/student
	 * Get student dashboard data
	 */
	static getStudentDashboard = asyncHandler(
		async (req: Request, res: Response) => {
			const userId = req.user!.userId;

			const data = await DashboardService.getStudentDashboard(userId);

			res.json({
				success: true,
				data,
			});
		}
	);
}
