import { Router } from "express";
import { TimetableController } from "@controllers/timetable.controller";
import { authenticate, authorize } from "@middleware/auth";
import { validate } from "@middleware/validator";
import {
	createTimetableEntrySchema,
	timetableIdSchema,
} from "@utils/validators";

const router = Router();

// Teacher routes
router.use(authenticate);

router.get(
    "/teacher",
    authorize("TEACHER"),
    TimetableController.getTeacherTimetable
);

router.post(
	"/",
	authorize("TEACHER"),
	validate(createTimetableEntrySchema),
	TimetableController.createEntry
);

router.put(
	"/:entryId",
	authorize("TEACHER"),
	validate(timetableIdSchema),
	TimetableController.updateEntry
);

router.delete(
	"/:entryId",
	authorize("TEACHER"),
	validate(timetableIdSchema),
	TimetableController.deleteEntry
);

router.get(
    "/enrollments/:enrollmentId",
    TimetableController.getEnrollmentTimetable
);

export default router;
