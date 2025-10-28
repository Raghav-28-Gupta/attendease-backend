import type { Request, Response } from "express";
import { AttendanceService } from "@services/attendance.service";
import { asyncHandler } from "@utils/asyncHandler";
import type {
	CreateAttendanceSessionDTO,
	MarkAttendanceDTO,
	UpdateAttendanceDTO,
} from "@local-types/models.types";
import { ApiError } from "@/utils/ApiError";

export class AttendanceController {
	/**
	 * POST /api/attendance/sessions
	 * Create new attendance session
	 */
	static createSession = asyncHandler(async (req: Request, res: Response) => {
		const teacherUserId = req.user!.userId;
		const data: CreateAttendanceSessionDTO = req.body;

		const session = await AttendanceService.createSession(
			teacherUserId,
			data
		);

		res.status(201).json({
			success: true,
			message: "Attendance session created successfully",
			data: session,
		});
	});

	/**
	 * GET /api/attendance/sessions/:sessionId/students
	 * Get students for a session (with existing records if marked)
	 */
	static getSessionStudents = asyncHandler(
		async (req: Request, res: Response) => {
			const { sessionId } = req.params;
			const teacherUserId = req.user!.userId;

			const students = await AttendanceService.getSessionStudents(
				sessionId!,
				teacherUserId
			);

			res.json({
				success: true,
				count: students.length,
				data: students,
			});
		}
	);

	/**
	 * POST /api/attendance/mark
	 * Mark attendance for multiple students
	 */
	static markAttendance = asyncHandler(
		async (req: Request, res: Response) => {
			const teacherUserId = req.user!.userId;
			const data: MarkAttendanceDTO = req.body;

			const result = await AttendanceService.markAttendance(
				teacherUserId,
				data
			);

			res.json({
				success: true,
				...result,
			});
		}
	);

	/**
	 * PUT /api/attendance/records/:recordId
	 * Update single attendance record (with reason)
	 */
	static updateRecord = asyncHandler(async (req: Request, res: Response) => {
		const { recordId } = req.params;
		const teacherUserId = req.user!.userId;
		const data: UpdateAttendanceDTO = req.body;

		const result = await AttendanceService.updateAttendanceRecord(
			recordId!,
			teacherUserId,
			data
		);

		res.json({
			success: true,
			...result,
		});
	});

	/**
	 * GET /api/attendance/sessions/:sessionId
	 * Get session details with all records
	 */
	static getSessionById = asyncHandler(
		async (req: Request, res: Response) => {
			const { sessionId } = req.params;
			const teacherUserId = req.user!.userId;

			const session = await AttendanceService.getSessionById(
				sessionId!,
				teacherUserId
			);

			res.json({
				success: true,
				data: session,
			});
		}
	);

	/**
	 * GET /api/attendance/teacher/sessions
	 * Get all sessions for logged-in teacher
	 */
	static getTeacherSessions = asyncHandler(
		async (req: Request, res: Response) => {
			const teacherUserId = req.user!.userId;
			const limit = parseInt(req.query.limit as string) || 20;

			const sessions = await AttendanceService.getTeacherSessions(
				teacherUserId,
				limit
			);

			res.json({
				success: true,
				count: sessions.length,
				data: sessions,
			});
		}
	);

	/**
	 * GET /api/attendance/enrollments/:enrollmentId/sessions
	 * Get all sessions for a specific enrollment
	 */
	static getEnrollmentSessions = asyncHandler(
		async (req: Request, res: Response) => {
			const { enrollmentId } = req.params;
			const teacherUserId = req.user!.userId;

			const sessions = await AttendanceService.getEnrollmentSessions(
				enrollmentId!,
				teacherUserId
			);

			res.json({
				success: true,
				count: sessions.length,
				data: sessions,
			});
		}
	);

	/**
	 * GET /api/attendance/students/:studentId/stats
	 * Get attendance statistics for a student in a subject
	 */
	static getStudentStats = asyncHandler(
		async (req: Request, res: Response) => {
			const { studentId } = req.params;
			const { subjectEnrollmentId } = req.query;

			if (!subjectEnrollmentId) {
				throw ApiError.badRequest(
					"subjectEnrollmentId query parameter required"
				);
			}

			const stats = await AttendanceService.getStudentAttendanceStats(
				studentId!,
				subjectEnrollmentId as string
			);

			res.json({
				success: true,
				data: stats,
			});
		}
	);

	/**
	 * GET /api/attendance/enrollments/:enrollmentId/summary
	 * Get attendance summary for all students in an enrollment
	 */
	static getEnrollmentSummary = asyncHandler(
		async (req: Request, res: Response) => {
			const { enrollmentId } = req.params;
			const teacherUserId = req.user!.userId;

			const summary =
				await AttendanceService.getEnrollmentAttendanceSummary(
					enrollmentId!,
					teacherUserId
				);

			res.json({
				success: true,
				data: summary,
			});
		}
	);

	/**
	 * DELETE /api/attendance/sessions/:sessionId
	 * Delete session (only if no records marked)
	 */
	static deleteSession = asyncHandler(async (req: Request, res: Response) => {
		const { sessionId } = req.params;
		const teacherUserId = req.user!.userId;

		const result = await AttendanceService.deleteSession(
			sessionId!,
			teacherUserId
		);

		res.json({
			success: true,
			...result,
		});
	});
}
