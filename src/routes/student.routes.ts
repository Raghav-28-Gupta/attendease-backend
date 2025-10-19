import { Router } from "express";
import { TimetableController } from "@controllers/timetable.controller";
import { authenticate, authorize } from "@middleware/auth";

const router = Router();

// All routes require student authentication
router.use(authenticate, authorize("STUDENT"));

// Get student's timetable
router.get("/me/timetable", TimetableController.getStudentTimetable);

// Get today's classes
router.get("/me/today", TimetableController.getTodayClasses);

export default router;
