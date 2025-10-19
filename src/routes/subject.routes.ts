import { Router } from "express";
import { SubjectController } from "@controllers/subject.controller";
import { BatchController } from "@controllers/batch.controller";
import { authenticate, authorize } from "@middleware/auth";
import { validate } from "@middleware/validator";
import {
	createSubjectSchema,
	updateSubjectSchema,
	subjectIdSchema,
} from "@utils/validators";

const router = Router();

// All routes require teacher authentication
router.use(authenticate, authorize("TEACHER"));

// Subject CRUD
router.post(
	"/",
	validate(createSubjectSchema),
	SubjectController.createSubject
);
router.get("/", SubjectController.getTeacherSubjects);
router.get(
	"/:subjectId",
	validate(subjectIdSchema),
	SubjectController.getSubjectById
);
router.put(
	"/:subjectId",
	validate(updateSubjectSchema),
	SubjectController.updateSubject
);
router.delete(
	"/:subjectId",
	validate(subjectIdSchema),
	SubjectController.deleteSubject
);

// Subject stats
router.get(
	"/:subjectId/stats",
	validate(subjectIdSchema),
	SubjectController.getSubjectStats
);

// Get batches for subject
router.get(
	"/:subjectId/batches",
	validate(subjectIdSchema),
	BatchController.getSubjectBatches
);

export default router;
