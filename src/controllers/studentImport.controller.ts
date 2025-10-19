import type { Request, Response } from "express";
import { StudentImportService } from "@services/studentImport.service";
import { asyncHandler } from "@utils/asyncHandler";
import { ApiError } from "@utils/ApiError";

export class StudentImportController {
	/**
	 * POST /api/batches/:batchId/students/import
	 * Import students via CSV upload
	 */
	static importStudentsCSV = asyncHandler(
		async (req: Request, res: Response) => {
			const { batchId } = req.params;
			const teacherId = req.user!.userId;

			// Check if file was uploaded
			if (!(req as any).file) {
				throw ApiError.badRequest("CSV file is required");
			}

			// Read CSV content
			const csvContent = (req as any).file.buffer.toString("utf-8");

			// Parse CSV
			const students = StudentImportService.parseCSV(csvContent);

			if (students.length === 0) {
				throw ApiError.badRequest("No valid students found in CSV");
			}

			// Import students
			const result = await StudentImportService.importStudentsToBatch(
				batchId!,
				teacherId,
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
	 */
	static addSingleStudent = asyncHandler(
		async (req: Request, res: Response) => {
			const { batchId } = req.params;
			const teacherId = req.user!.userId;

			const student = await StudentImportService.addSingleStudent(
				batchId!,
				teacherId,
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
	 */
	static removeStudent = asyncHandler(async (req: Request, res: Response) => {
		const { batchId, studentId } = req.params;
		const teacherId = req.user!.userId;

		const result = await StudentImportService.removeStudentFromBatch(
			batchId!,
			studentId!,
			teacherId
		);

		res.json({
			success: true,
			...result,
		});
	});

	/**
	 * GET /api/batches/:batchId/students/template
	 * Download CSV template for student import
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
				"attachment; filename=student_import_template.csv"
			);
			res.send(csvTemplate);
		}
	);
}
