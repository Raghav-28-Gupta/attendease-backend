import type { Request, Response } from "express";
import { StudentImportService } from "@services/studentImport.service";
import { asyncHandler } from "@utils/asyncHandler";
import { ApiError } from "@utils/ApiError";
import type { ImportStudentDTO } from "@local-types/models.types";

export class StudentImportController {
	/**
	 * POST /api/batches/:batchId/students/import
	 * Import students via CSV (teachers only)
	 * Teachers can only import to batches they teach
	 */
	static importStudentsCSV = asyncHandler(
		async (req: Request, res: Response) => {
			const { batchId } = req.params;
			const teacherUserId = req.user!.userId; // ✅ Get teacher from auth

			// Validate batchId exists
			if (!batchId) {
				throw ApiError.badRequest("Batch ID is required");
			}

			// Validate file upload
			if (!req.file) {
				throw ApiError.badRequest("CSV file is required");
			}

			// Parse CSV content
			const csvContent = req.file.buffer.toString("utf-8");
			const students = StudentImportService.parseCSV(csvContent);

			if (students.length === 0) {
				throw ApiError.badRequest("No valid students found in CSV");
			}

			// Import with teacher authorization
			const result = await StudentImportService.importStudentsToBatch(
				batchId,
				teacherUserId, // ✅ Pass teacher for authorization
				students
			);

			res.status(201).json({
				success: true,
				message: `Import completed: ${result.successful} successful, ${result.failed} failed`,
				data: result,
			});
		}
	);

	/**
	 * POST /api/batches/:batchId/students
	 * Add single student manually
	 * Teachers can only add to batches they teach
	 */
	static addSingleStudent = asyncHandler(
		async (req: Request, res: Response) => {
			const { batchId } = req.params;
			const teacherUserId = req.user!.userId; // ✅ Get teacher from auth

			// Validate batchId exists
			if (!batchId) {
				throw ApiError.badRequest("Batch ID is required");
			}

			// Add student with teacher authorization
			const student = await StudentImportService.addSingleStudent(
				batchId,
				teacherUserId, // ✅ Pass teacher for authorization
				req.body
			);

			res.status(201).json({
				success: true,
				message: "Student added successfully",
				data: student,
			});
		}
	);

	/**
	 * DELETE /api/batches/:batchId/students/:studentId
	 * Remove student from batch
	 * Teachers can only remove from batches they teach
	 */
	static removeStudent = asyncHandler(async (req: Request, res: Response) => {
		const { batchId, studentId } = req.params;
		const teacherUserId = req.user!.userId; // ✅ Get teacher from auth

		// Validate parameters exist
		if (!batchId) {
			throw ApiError.badRequest("Batch ID is required");
		}

		if (!studentId) {
			throw ApiError.badRequest("Student ID is required");
		}

		// Remove student with teacher authorization
		const result = await StudentImportService.removeStudentFromBatch(
			batchId,
			studentId,
			teacherUserId // ✅ Pass teacher for authorization
		);

		res.json({
			success: true,
			...result,
		});
	});

	/**
	 * GET /api/batches/:batchId/students/template
	 * Download CSV template for student import
	 * Public to authenticated users
	 */
	static downloadTemplate = asyncHandler(
		async (req: Request, res: Response) => {
			const csvTemplate = `student_id,first_name,last_name,email,phone
2100123,Amit,Sharma,amit@college.edu,9876543210
2100124,Priya,Singh,priya@college.edu,9876543211
2100125,Rahul,Kumar,rahul@college.edu,9876543212`;

			res.setHeader("Content-Type", "text/csv");
			res.setHeader(
				"Content-Disposition",
				"attachment; filename=students_import_template.csv"
			);
			res.send(csvTemplate);
		}
	);
}
