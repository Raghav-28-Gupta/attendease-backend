import { Router } from "express";
import { AttendanceController } from "@controllers/attendance.controller";
import { authenticate, authorize } from "@middleware/auth";
import { validate } from "@middleware/validator";
import {
	createAttendanceSessionSchema,
	markAttendanceSchema,
	updateAttendanceSchema,
	attendanceSessionIdSchema,
	attendanceRecordIdSchema,
	getStudentAttendanceSchema,
	getEnrollmentAttendanceSchema,
	getMyAttendanceBySubjectSchema,
} from "@utils/validators";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ===== TEACHER ROUTES =====

/**
 * POST /api/attendance/sessions
 * Create new attendance session
 */
router.post(
	"/sessions",
	authorize("TEACHER"),
	validate(createAttendanceSessionSchema),
	AttendanceController.createSession
);

/**
 * GET /api/attendance/sessions/:sessionId/students
 * Get students for session (to mark attendance)
 */
router.get(
	"/sessions/:sessionId/students",
	authorize("TEACHER"),
	validate(attendanceSessionIdSchema),
	AttendanceController.getSessionStudents
);

/**
 * POST /api/attendance/mark
 * Mark attendance (bulk operation)
 */
router.post(
	"/mark",
	authorize("TEACHER"),
	validate(markAttendanceSchema),
	AttendanceController.markAttendance
);

/**
 * PUT /api/attendance/records/:recordId
 * Update single attendance record
 */
router.put(
	"/records/:recordId",
	authorize("TEACHER"),
	validate(updateAttendanceSchema),
	AttendanceController.updateRecord
);

/**
 * GET /api/attendance/sessions/:sessionId
 * Get session details with records
 */
router.get(
	"/sessions/:sessionId",
	authorize("TEACHER"),
	validate(attendanceSessionIdSchema),
	AttendanceController.getSessionById
);

/**
 * GET /api/attendance/teacher/sessions
 * Get all sessions for logged-in teacher
 */
router.get(
	"/teacher/sessions",
	authorize("TEACHER"),
	AttendanceController.getTeacherSessions
);

/**
 * GET /api/attendance/enrollments/:enrollmentId/sessions
 * Get sessions for specific enrollment
 */
router.get(
	"/enrollments/:enrollmentId/sessions",
	authorize("TEACHER"),
	AttendanceController.getEnrollmentSessions
);

/**
 * GET /api/attendance/enrollments/:enrollmentId/summary
 * Get attendance summary for enrollment
 */
router.get(
	"/enrollments/:enrollmentId/summary",
	authorize("TEACHER"),
	validate(getEnrollmentAttendanceSchema),
	AttendanceController.getEnrollmentSummary
);

/**
 * DELETE /api/attendance/sessions/:sessionId
 * Delete session (only if unmarked)
 */
router.delete(
	"/sessions/:sessionId",
	authorize("TEACHER"),
	validate(attendanceSessionIdSchema),
	AttendanceController.deleteSession
);

// ===== STUDENT ROUTES =====

/**
 * GET /api/attendance/students/:studentId/stats
 * Get student attendance statistics
 * Teachers can view any student, students can view only themselves
 */
router.get(
	"/students/:studentId/stats",
	validate(getStudentAttendanceSchema),
	AttendanceController.getStudentStats
);

/**
 * GET /api/attendance/subjects/:subjectCode/my-attendance
 * Get logged-in student's attendance for a specific subject by subject code
 */
router.get(
    "/subjects/:subjectCode/my-attendance",
    authorize("STUDENT"), // Students only
    validate(getMyAttendanceBySubjectSchema),
    AttendanceController.getMyAttendanceBySubject
);

router.get(
    "/students/me/summary",
    authenticate,  // Students can access their own summary
    AttendanceController.getStudentSummary
);

export default router;
