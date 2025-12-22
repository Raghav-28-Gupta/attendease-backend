import { Router } from "express";
import { SubjectEnrollmentController } from "@controllers/subjectEnrollment.controller";
import { authenticate, authorize } from "@middleware/auth";
import { validate } from "@middleware/validator";
import {
	enrollBatchesSchema,
	subjectEnrollmentIdSchema,
	updateSubjectEnrollmentSchema,
	subjectIdSchema,
	batchIdSchema,
} from "@utils/validators";

const router = Router();

// ✅ All routes require authentication
router.use(authenticate);

// ===== PUBLIC (Authenticated) ROUTES =====
/**
* GET /api/enrollments
 * Get all enrollments for authenticated teacher
 * Teacher-only route
 */
router.get(
    "/",
    authorize("TEACHER"),
    SubjectEnrollmentController.getTeacherEnrollments  // New method
);

/**
 * GET /api/enrollments/batches/:batchId/subjects
 * Get all subjects a batch is enrolled in (with teacher info)
 * Public to authenticated users - students need to see their subjects
 */
router.get(
	"/batches/:batchId/subjects",
	validate(batchIdSchema),
	SubjectEnrollmentController.getBatchSubjects
);

/**
 * GET /api/enrollments/subjects/:subjectId
 * Get all batch enrollments for a subject
 * Teachers see only their enrollments
 */
router.get(
	"/subjects/:subjectId",
	validate(subjectIdSchema),
	SubjectEnrollmentController.getSubjectEnrollments    
);

/**
 * GET /api/enrollments/:enrollmentId
 * Get specific enrollment details
 * Teachers see only their enrollments
 */
router.get(
	"/:enrollmentId",
	validate(subjectEnrollmentIdSchema),
	SubjectEnrollmentController.getEnrollmentById
);

// ===== TEACHER ROUTES =====

/**
 * POST /api/enrollments
 * Enroll batches to subject (teacher assigns themselves)
 * Teacher-only route
 */
router.post(
	"/",
	authorize("TEACHER"),
	validate(enrollBatchesSchema),
	SubjectEnrollmentController.enrollBatches
);

/**
 * PUT /api/enrollments/:enrollmentId
 * Update enrollment (change teacher, room, status, etc.)
 * Teacher who owns enrollment 
 */
router.put(
	"/:enrollmentId",
	authorize("TEACHER"),
	validate(updateSubjectEnrollmentSchema),
	SubjectEnrollmentController.updateEnrollment
);

/**
 * DELETE /api/enrollments/:enrollmentId
 * Unenroll batch from subject (remove enrollment)
 * Teacher who owns enrollment
 */
router.delete(
	"/:enrollmentId",
	authorize("TEACHER"),
	validate(subjectEnrollmentIdSchema),
	SubjectEnrollmentController.unenrollBatch
);

export default router;
