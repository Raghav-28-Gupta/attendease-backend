import { Router } from "express";
import { SubjectController } from "@controllers/subject.controller";
import { authenticate, authorize } from "@middleware/auth";
import { validate } from "@middleware/validator";
import {
	createSubjectSchema,
	updateSubjectSchema,
	subjectIdSchema,
} from "@utils/validators";

const router = Router();

// ✅ All routes require authentication
router.use(authenticate);

// ===== PUBLIC (Authenticated) ROUTES =====

// Search subjects (any authenticated user)
router.get("/search", SubjectController.searchSubjects);

// Get all subjects with optional department filter (any authenticated user)
router.get("/", SubjectController.getAllSubjects);

// Get subject by ID (any authenticated user)
router.get(
	"/:subjectId",
	validate(subjectIdSchema),
	SubjectController.getSubjectById
);

// Get subject statistics (any authenticated user)
router.get(
	"/:subjectId/stats",
	validate(subjectIdSchema),
	SubjectController.getSubjectStats
);

// ===== TEACHER-ONLY ROUTES =====

// Get subjects taught by logged-in teacher
router.get(
	"/my-subjects",
	authorize("TEACHER"),
	SubjectController.getTeacherSubjects
);

// Create subject
router.post(
	"/",
	authorize("TEACHER"),
	validate(createSubjectSchema),
	SubjectController.createSubject
);

router.put(
	"/:subjectId",
	authorize("TEACHER"),
	validate(updateSubjectSchema),
	SubjectController.updateSubject
);

router.delete(
	"/:subjectId",
	authorize("TEACHER"),
	validate(subjectIdSchema),
	SubjectController.deleteSubject
);

export default router;
