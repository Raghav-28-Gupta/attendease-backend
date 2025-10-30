import { getIO } from "@config/socket";
import logger from "@utils/logger";
import type {
	AttendanceSessionWithDetails,
	AttendanceStatsDTO,
} from "@local-types/models.types";

export class WebSocketService {
	/**
	 * Emit attendance marked event to batch
	 */
	static emitAttendanceMarked(
		batchId: string,
		session: AttendanceSessionWithDetails,
		markedCount: number
	) {
		try {
			const io = getIO();

			const event = {
				type: "ATTENDANCE_MARKED",
				sessionId: session.id,
				subjectCode: session.subjectEnrollment.subject.code,
				subjectName: session.subjectEnrollment.subject.name,
				batchCode: session.subjectEnrollment.batch.code,
				date: session.date,
				startTime: session.startTime,
				endTime: session.endTime,
				markedCount,
				timestamp: new Date(),
			};

			// Emit to all students in batch
			io.to(`batch:${batchId}`).emit("attendance_marked", event);

			logger.info(
				`WebSocket: Attendance marked event sent to batch:${batchId}`
			);
		} catch (error) {
			logger.error("Failed to emit attendance_marked event:", error);
		}
	}

	/**
	 * Emit attendance updated event to specific student
	 */
	static emitAttendanceUpdated(
		studentUserId: string,
		data: {
			subjectCode: string;
			subjectName: string;
			newPercentage: number;
			status: "GOOD" | "WARNING" | "CRITICAL";
			stats: AttendanceStatsDTO;
		}
	) {
		try {
			const io = getIO();

			const event = {
				type: "ATTENDANCE_UPDATED",
				...data,
				timestamp: new Date(),
			};

			// Emit to specific student
			io.to(`user:${studentUserId}`).emit("attendance_updated", event);

			logger.info(
				`WebSocket: Attendance updated event sent to user:${studentUserId}`
			);
		} catch (error) {
			logger.error("Failed to emit attendance_updated event:", error);
		}
	}

	/**
	 * Emit low attendance alert to student
	 */
	static emitLowAttendanceAlert(
		studentUserId: string,
		data: {
			subjectCode: string;
			subjectName: string;
			percentage: number;
			sessionsNeeded: number;
			status: "WARNING" | "CRITICAL";
		}
	) {
		try {
			const io = getIO();

			const event = {
				type: "LOW_ATTENDANCE_ALERT",
				...data,
				message:
					data.status === "CRITICAL"
						? `Critical: ${data.percentage}% attendance in ${data.subjectName}. Attend ${data.sessionsNeeded} more classes!`
						: `Warning: ${data.percentage}% attendance in ${data.subjectName}. Need ${data.sessionsNeeded} more classes to reach 75%.`,
				timestamp: new Date(),
			};

			// Emit to specific student
			io.to(`user:${studentUserId}`).emit("low_attendance_alert", event);

			logger.info(
				`WebSocket: Low attendance alert sent to user:${studentUserId} (${data.percentage}%)`
			);
		} catch (error) {
			logger.error("Failed to emit low_attendance_alert event:", error);
		}
	}

	/**
	 * Emit session created event to enrollment room
	 */
	static emitSessionCreated(
		enrollmentId: string,
		session: AttendanceSessionWithDetails
	) {
		try {
			const io = getIO();

			const event = {
				type: "SESSION_CREATED",
				sessionId: session.id,
				subjectCode: session.subjectEnrollment.subject.code,
				subjectName: session.subjectEnrollment.subject.name,
				batchCode: session.subjectEnrollment.batch.code,
				date: session.date,
				startTime: session.startTime,
				endTime: session.endTime,
				timestamp: new Date(),
			};

			// Emit to enrollment room (teachers and students)
			io.to(`enrollment:${enrollmentId}`).emit("session_created", event);

			logger.info(
				`WebSocket: Session created event sent to enrollment:${enrollmentId}`
			);
		} catch (error) {
			logger.error("Failed to emit session_created event:", error);
		}
	}

	/**
	 * Emit attendance record edited event
	 */
	static emitAttendanceEdited(
		studentUserId: string,
		data: {
			recordId: string;
			sessionId: string;
			subjectCode: string;
			oldStatus: string;
			newStatus: string;
			editedBy: string;
			reason: string;
		}
	) {
		try {
			const io = getIO();

			const event = {
				type: "ATTENDANCE_EDITED",
				...data,
				timestamp: new Date(),
			};

			// Emit to specific student
			io.to(`user:${studentUserId}`).emit("attendance_edited", event);

			logger.info(
				`WebSocket: Attendance edited event sent to user:${studentUserId}`
			);
		} catch (error) {
			logger.error("Failed to emit attendance_edited event:", error);
		}
	}

	/**
	 * Emit live session status (for teachers)
	 */
	static emitLiveSessionStatus(
		enrollmentId: string,
		data: {
			sessionId: string;
			totalStudents: number;
			markedCount: number;
			presentCount: number;
			absentCount: number;
		}
	) {
		try {
			const io = getIO();

			const event = {
				type: "LIVE_SESSION_STATUS",
				...data,
				progress: (data.markedCount / data.totalStudents) * 100,
				timestamp: new Date(),
			};

			// Emit to enrollment room (teachers)
			io.to(`enrollment:${enrollmentId}`).emit(
				"live_session_status",
				event
			);

			logger.info(
				`WebSocket: Live session status sent to enrollment:${enrollmentId}`
			);
		} catch (error) {
			logger.error("Failed to emit live_session_status event:", error);
		}
	}
}
