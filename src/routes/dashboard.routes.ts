import { Router } from "express";
import { DashboardController } from "@controllers/dashboard.controller";
import { authenticate, authorize } from "@middleware/auth";

const router = Router();

router.use(authenticate);

/**
 * GET /api/dashboard/teacher
 * Teacher dashboard with enrollments, stats, low attendance alerts
 */
router.get(
	"/teacher",
	authorize("TEACHER"),
	DashboardController.getTeacherDashboard
);

/**
 * GET /api/dashboard/student
 * Student dashboard with subjects, attendance, alerts
 */
router.get(
	"/student",
	authorize("STUDENT"),
	DashboardController.getStudentDashboard
);

export default router;
