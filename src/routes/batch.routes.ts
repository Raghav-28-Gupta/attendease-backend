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
	bulkCreateTimetableSchema,
} from "@utils/validators";

const router = Router();

// ===== MULTER CONFIGURATION =====
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

// ===== GLOBAL AUTHENTICATION =====
// All batch routes require authentication
router.use(authenticate);

// ===== PUBLIC (Authenticated) ROUTES =====

/**
 * GET /api/batches
 * Get all batches (filtered by role in controller)
 * - Students: See their own batch
 * - Teachers: See batches they teach
 * - Admins: See all batches
 */
router.get("/", BatchController.getAllBatches);

/**
 * GET /api/batches/:batchId
 * Get batch details with full information
 * Public to authenticated users
 */
router.get("/:batchId", validate(batchIdSchema), BatchController.getBatchById);

/**
 * GET /api/batches/:batchId/students
 * Get all students in a batch
 * Public to authenticated users - students/teachers need to see classmates
 */
router.get(
	"/:batchId/students",
	validate(batchIdSchema),
	BatchController.getBatchStudents
);

/**
 * GET /api/batches/:batchId/timetable
 * Get batch timetable
 * Public to authenticated users - students need to see their schedule
 */
router.get(
	"/:batchId/timetable",
	validate(batchIdSchema),
	TimetableController.getBatchTimetable
);

/**
 * GET /api/batches/:batchId/students/template
 * Download CSV template for student import
 * Public to authenticated users (teachers will use it)
 */
router.get(
	"/:batchId/students/template",
	StudentImportController.downloadTemplate
);

// ===== TEACHER/ADMIN ROUTES =====

/**
 * POST /api/batches
 * Create new batch
 * Teachers can create batches, admins have full access
 */
router.post(
	"/",
	authorize("TEACHER", "ADMIN"),
	validate(createBatchSchema),
	BatchController.createBatch
);

/**
 * PUT /api/batches/:batchId
 * Update batch details
 * Admins only (to prevent conflicts between teachers)
 */
router.put(
	"/:batchId",
	authorize("ADMIN"),
	validate(updateBatchSchema),
	BatchController.updateBatch
);

/**
 * DELETE /api/batches/:batchId
 * Delete batch
 * Admins only (critical operation)
 */
router.delete(
	"/:batchId",
	authorize("ADMIN"),
	validate(batchIdSchema),
	BatchController.deleteBatch
);

/**
 * POST /api/batches/:batchId/students/import
 * Import students via CSV
 * Teachers who teach this batch or admins
 */
router.post(
	"/:batchId/students/import",
	authorize("TEACHER", "ADMIN"),
	validate(batchIdSchema),
	upload.single("csv"),
	StudentImportController.importStudentsCSV
);

/**
 * POST /api/batches/:batchId/students
 * Add single student manually
 * Teachers who teach this batch or admins
 */
router.post(
	"/:batchId/students",
	authorize("TEACHER", "ADMIN"),
	validate(batchIdSchema),
	StudentImportController.addSingleStudent
);

/**
 * DELETE /api/batches/:batchId/students/:studentId
 * Remove student from batch
 * Teachers who teach this batch or admins
 */
router.delete(
	"/:batchId/students/:studentId",
	authorize("TEACHER", "ADMIN"),
	StudentImportController.removeStudent
);

/**
 * POST /api/batches/:batchId/timetable/bulk
 * Bulk create timetable entries for batch
 * Teachers who teach this batch or admins
 */
router.post(
	"/:batchId/timetable/bulk",
	authorize("TEACHER", "ADMIN"),
	validate(bulkCreateTimetableSchema),
	TimetableController.bulkCreateEntries
);

export default router;
