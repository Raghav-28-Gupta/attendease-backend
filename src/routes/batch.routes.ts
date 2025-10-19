import { Router } from "express";
import { BatchController } from "@controllers/batch.controller";
import { StudentImportController } from "@controllers/studentImport.controller";
import { TimetableController } from "@controllers/timetable.controller";
import { authenticate, authorize } from "@middleware/auth";
import { validate } from "@middleware/validator";
import multer from "multer";
import {
	createBatchSchema,
	updateBatchSchema,
	batchIdSchema,
	importStudentsSchema,
	bulkCreateTimetableSchema,
} from "@utils/validators";

const router = Router();

// Multer config for CSV upload
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
	fileFilter: (req, file, cb) => {
		if (
			file.mimetype === "text/csv" ||
			file.originalname.endsWith(".csv")
		) {
			cb(null, true);
		} else {
			cb(new Error("Only CSV files are allowed"));
		}
	},
});

// All routes require teacher authentication
router.use(authenticate, authorize("TEACHER"));

// Batch CRUD
router.post("/", validate(createBatchSchema), BatchController.createBatch);
router.get("/:batchId", validate(batchIdSchema), BatchController.getBatchById);
router.put(
	"/:batchId",
	validate(updateBatchSchema),
	BatchController.updateBatch
);
router.delete(
	"/:batchId",
	validate(batchIdSchema),
	BatchController.deleteBatch
);

// Student management
router.get(
	"/:batchId/students",
	validate(batchIdSchema),
	BatchController.getBatchStudents
);

router.post(
	"/:batchId/students/import",
	validate(importStudentsSchema),
	upload.single("csv"),
	StudentImportController.importStudentsCSV
);

router.get(
	"/:batchId/students/template",
	validate(batchIdSchema),
	StudentImportController.downloadTemplate
);

router.post(
	"/:batchId/students",
	validate(batchIdSchema),
	StudentImportController.addSingleStudent
);

router.delete(
	"/:batchId/students/:studentId",
	validate(batchIdSchema),
	StudentImportController.removeStudent
);

// Timetable management
router.get(
	"/:batchId/timetable",
	validate(batchIdSchema),
	TimetableController.getBatchTimetable
);

router.post(
	"/:batchId/timetable/bulk",
	validate(bulkCreateTimetableSchema),
	TimetableController.bulkCreateEntries
);

export default router;
