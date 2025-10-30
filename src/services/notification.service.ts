import prisma from "@config/database";
import { getMessaging } from "@config/firebase";
import logger from "@utils/logger";
import { ApiError } from "@utils/ApiError";

export class NotificationService {
	/**
	 * Register FCM token for a student
	 */
	static async registerFCMToken(
		studentUserId: string,
		token: string,
		deviceId?: string
	) {
		const student = await prisma.student.findUnique({
			where: { userId: studentUserId },
		});

		if (!student) {
			throw ApiError.notFound("Student not found");
		}

		// Check if token already exists
		const existing = await prisma.fCMToken.findUnique({
			where: { token },
		});

		if (existing) {
			// Update existing token
			await prisma.fCMToken.update({
				where: { token },
				data: {
					studentId: student.id,
					deviceId,
					updatedAt: new Date(),
				},
			});
		} else {
			// Create new token
			await prisma.fCMToken.create({
				data: {
					studentId: student.id,
					token,
					deviceId,
				},
			});
		}

		logger.info(`FCM token registered for student ${student.studentId}`);

		return { message: "FCM token registered successfully" };
	}

	/**
	 * Unregister FCM token
	 */
	static async unregisterFCMToken(token: string) {
		await prisma.fCMToken.delete({
			where: { token },
		});

		logger.info(`FCM token unregistered: ${token}`);

		return { message: "FCM token unregistered successfully" };
	}

	/**
	 * Send push notification to student
	 */
	static async sendPushNotification(
		studentUserId: string,
		notification: {
			title: string;
			body: string;
			data?: Record<string, string>;
		}
	) {
		try {
			const student = await prisma.student.findUnique({
				where: { userId: studentUserId },
				include: {
					fcmTokens: true,
				},
			});

			if (!student || student.fcmTokens.length === 0) {
				logger.warn(`No FCM tokens found for student ${studentUserId}`);
				return { sent: 0 };
			}

			const messaging = getMessaging();
			const tokens = student.fcmTokens.map((t) => t.token);

			const message = {
				notification: {
					title: notification.title,
					body: notification.body,
				},
				data: notification.data || {},
				tokens,
			};

			const response = await messaging.sendEachForMulticast(message);

			logger.info(
				`Push notifications sent: ${response.successCount}/${tokens.length} successful`
			);

			// Clean up invalid tokens
			if (response.failureCount > 0) {
				const invalidTokens: string[] = [];
				response.responses.forEach((resp, idx) => {
					if (!resp.success && tokens[idx]) {
						invalidTokens.push(tokens[idx]);
					}
				});

				await prisma.fCMToken.deleteMany({
					where: { token: { in: invalidTokens } },
				});

				logger.info(`Removed ${invalidTokens.length} invalid FCM tokens`);
			}

			return {
				sent: response.successCount,
				failed: response.failureCount,
			};
		} catch (error) {
			logger.error("Failed to send push notification:", error);
			return { sent: 0, failed: 1 };
		}
	}

	/**
	 * Send low attendance alert via push notification
	 */
	static async sendLowAttendanceAlert(
		studentUserId: string,
		data: {
			subjectCode: string;
			subjectName: string;
			percentage: number;
			sessionsNeeded: number;
			status: "WARNING" | "CRITICAL";
		}
	) {
		const title =
			data.status === "CRITICAL"
				? `🚨 Critical: ${data.subjectCode} Attendance`
				: `⚠️ Warning: ${data.subjectCode} Attendance`;

		const body =
			data.status === "CRITICAL"
				? `Your ${data.subjectName} attendance is ${data.percentage}%. Attend ${data.sessionsNeeded} more classes urgently!`
				: `Your ${data.subjectName} attendance is ${data.percentage}%. Attend ${data.sessionsNeeded} more classes to reach 75%.`;

		return this.sendPushNotification(studentUserId, {
			title,
			body,
			data: {
				type: "LOW_ATTENDANCE",
				subjectCode: data.subjectCode,
				percentage: data.percentage.toString(),
				status: data.status,
			},
		});
	}

	/**
	 * Send attendance marked notification
	 */
	static async sendAttendanceMarkedNotification(
		studentUserId: string,
		data: {
			subjectCode: string;
			subjectName: string;
			status: string;
			date: string;
		}
	) {
		const statusEmoji =
			{
				PRESENT: "✅",
				ABSENT: "❌",
				LATE: "⏰",
				EXCUSED: "📝",
			}[data.status] || "📊";

		return this.sendPushNotification(studentUserId, {
			title: `${statusEmoji} Attendance Marked`,
			body: `${data.subjectName}: Marked ${data.status} on ${data.date}`,
			data: {
				type: "ATTENDANCE_MARKED",
				subjectCode: data.subjectCode,
				status: data.status,
				date: data.date,
			},
		});
	}
}
