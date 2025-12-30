import prisma from "@config/database";
import { getMessaging } from "@config/firebase";
import logger from "@utils/logger";
import { ApiError } from "@utils/ApiError";
import { EmailService } from "./email.service";

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
	 * Send low attendance alert via push notification + email alerts
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
		try {
			// Get student info with email
			const student = await prisma.student.findUnique({
				where: { userId: studentUserId },
				include: {
					user: {
						select: {
							email: true,
						},
					},
				},
			});

			if (!student) {
				logger.warn(`Student not found for userId: ${studentUserId}`);
				return { sent: 0, emailSent: false };
			}

			const studentName = `${student.firstName} ${student.lastName}`;

			// Send push notification
			const title =
				data.status === "CRITICAL"
					? `🚨 Critical: ${data.subjectCode} Attendance`
					: `⚠️ Warning: ${data.subjectCode} Attendance`;

			const body =
				data.status === "CRITICAL"
					? `Your ${
							data.subjectName
					  } attendance is ${data.percentage.toFixed(1)}%. Attend ${
							data.sessionsNeeded
					  } more classes urgently!`
					: `Your ${
							data.subjectName
					  } attendance is ${data.percentage.toFixed(1)}%. Attend ${
							data.sessionsNeeded
					  } more classes to reach 75%.`;

			const pushResult = await this.sendPushNotification(studentUserId, {
				title,
				body,
				data: {
					type: "LOW_ATTENDANCE",
					subjectCode: data.subjectCode,
					percentage: data.percentage.toString(),
					status: data.status,
				},
			});

			// Send email notification (CRITICAL alerts only)
			let emailSent = false;
			if (data.status === "CRITICAL") {
				try {
					await EmailService.sendLowAttendanceAlertEmail(
						student.user.email,
						{
							studentName,
							subjectCode: data.subjectCode,
							subjectName: data.subjectName,
							percentage: data.percentage,
							sessionsNeeded: data.sessionsNeeded,
							status: data.status,
						}
					);

					logger.info(
						`Critical attendance email sent to ${student.user.email} for ${data.subjectCode}`
					);
					emailSent = true;
				} catch (emailError) {
					logger.error("Failed to send low attendance email:", emailError);
					// Don't fail the entire operation if email fails
				}
			}

			return {
				sent: pushResult.sent,
				failed: pushResult.failed,
				emailSent,
			};
		} catch (error) {
			logger.error("Failed to send low attendance alert:", error);
			return { sent: 0, failed: 1, emailSent: false };
		}
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

	// ==================== TEACHER NOTIFICATION METHODS ====================

	/**
	 * Register FCM token for a teacher
	 */
	static async registerTeacherFCMToken(
		teacherUserId: string,
		token: string,
		deviceId?: string
	) {
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher not found");
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
					teacherId: teacher.id,
					studentId: null, // Clear student association if any
					deviceId,
					updatedAt: new Date(),
				},
			});
		} else {
			// Create new token
			await prisma.fCMToken.create({
				data: {
					teacherId: teacher.id,
					token,
					deviceId,
				},
			});
		}

		logger.info(`FCM token registered for teacher ${teacher.employeeId}`);

		return { message: "FCM token registered successfully" };
	}

	/**
	 * Send push notification to teacher
	 */
	static async sendTeacherPushNotification(
		teacherUserId: string,
		notification: {
			title: string;
			body: string;
			data?: Record<string, string>;
		}
	) {
		try {
			const teacher = await prisma.teacher.findUnique({
				where: { userId: teacherUserId },
				include: {
					fcmTokens: true,
				},
			});

			if (!teacher || teacher.fcmTokens.length === 0) {
				logger.warn(`No FCM tokens found for teacher ${teacherUserId}`);
				return { sent: 0 };
			}

			const messaging = getMessaging();
			const tokens = teacher.fcmTokens.map((t) => t.token);

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
				`Push notifications sent to teacher: ${response.successCount}/${tokens.length} successful`
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
			logger.error("Failed to send push notification to teacher:", error);
			return { sent: 0, failed: 1 };
		}
	}

	/**
	 * Send class reminder notification to teacher
	 */
	static async sendClassReminderNotification(
		teacherUserId: string,
		data: {
			enrollmentId: string;
			subjectCode: string;
			subjectName: string;
			batchCode: string;
			startTime: string;
			endTime: string;
		}
	) {
		return this.sendTeacherPushNotification(teacherUserId, {
			title: `📚 Class Reminder: ${data.subjectCode}`,
			body: `${data.subjectName} for ${data.batchCode} starts at ${data.startTime}. Don't forget to take attendance!`,
			data: {
				type: "CLASS_REMINDER",
				action: "CREATE_SESSION",
				enrollmentId: data.enrollmentId,
				subjectCode: data.subjectCode,
				subjectName: data.subjectName,
				batchCode: data.batchCode,
				startTime: data.startTime,
				endTime: data.endTime,
			},
		});
	}

	/**
	 * Get today's classes for a teacher (for scheduling reminders)
	 */
	static async getTodayClassesForReminder(teacherUserId: string) {
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher not found");
		}

		// Get current day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
		const today = new Date();
		const dayOfWeek = today.getDay();
		const dayNames = [
			"SUNDAY",
			"MONDAY",
			"TUESDAY",
			"WEDNESDAY",
			"THURSDAY",
			"FRIDAY",
			"SATURDAY",
		];
		const todayDayName = dayNames[dayOfWeek];

		// Skip Sunday
		if (todayDayName === "SUNDAY") {
			return { classes: [], message: "No classes on Sunday" };
		}

		// Get all enrollments for this teacher with timetable entries for today
		const enrollments = await prisma.subjectEnrollment.findMany({
			where: {
				teacherId: teacher.id,
				status: "ACTIVE",
			},
			include: {
				subject: true,
				batch: true,
				timetableEntries: {
					where: {
						dayOfWeek: todayDayName,
					},
				},
			},
		});

		// Get today's date string for checking existing sessions
		const todayDateString = today.toISOString().split("T")[0];

		// Check for existing sessions today for each enrollment
		const classes = [];

		for (const enrollment of enrollments) {
			for (const entry of enrollment.timetableEntries) {
				// Check if session already exists for this slot
				const existingSession = await prisma.attendanceSession.findFirst({
					where: {
						subjectEnrollmentId: enrollment.id,
						date: {
							gte: new Date(`${todayDateString}T00:00:00.000Z`),
							lt: new Date(`${todayDateString}T23:59:59.999Z`),
						},
						startTime: entry.startTime,
					},
				});

				classes.push({
					enrollmentId: enrollment.id,
					subjectCode: enrollment.subject.code,
					subjectName: enrollment.subject.name,
					batchCode: enrollment.batch.code,
					batchName: enrollment.batch.name,
					dayOfWeek: entry.dayOfWeek,
					startTime: entry.startTime,
					endTime: entry.endTime,
					room: entry.classRoom,
					hasExistingSession: !!existingSession,
				});
			}
		}

		// Sort by start time
		classes.sort((a, b) => a.startTime.localeCompare(b.startTime));

		return {
			date: todayDateString,
			dayOfWeek: todayDayName,
			classes,
		};
	}
}
