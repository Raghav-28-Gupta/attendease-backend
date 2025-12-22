import { Router } from "express";
import { TimetableController } from "@controllers/timetable.controller";
import { authenticate, authorize } from "@middleware/auth";
import { StudentController } from "@/controllers/student.controller";

const router = Router();

// All routes require student authentication
router.use(authenticate, authorize("STUDENT"));

// Get student's profile
router.get("/me", StudentController.getMyProfile);

// Update student's profile
router.put("/me", StudentController.updateMyProfile);

// Get student's timetable
router.get("/me/timetable", TimetableController.getStudentTimetable);

// Get today's classes
router.get("/me/today", TimetableController.getTodayClasses);

// Get student's batch with enrolled subjects
router.get("/me/batch", StudentController.getMyBatch);

/**
 * GET /api/students/:studentId
 * Get student details with attendance stats
 */
router.get(
    "/:studentId",
    authenticate,
    authorize("TEACHER"),
    StudentController.getStudentById
);

export default router;
