import type { Request, Response } from "express";
import { NotificationService } from "@services/notification.service";
import { asyncHandler } from "@utils/asyncHandler";
import { ApiError } from "@utils/ApiError";

export class NotificationController {
	/**
	 * POST /api/notifications/fcm/register
	 * Register FCM token for push notifications
	 */
	static registerFCMToken = asyncHandler(
		async (req: Request, res: Response) => {
			const userId = req.user!.userId;
			const { token, deviceId } = req.body;

			if (!token) {
				throw ApiError.badRequest("FCM token is required");
			}

			const result = await NotificationService.registerFCMToken(
				userId,
				token,
				deviceId
			);

			res.json({
				success: true,
				...result,
			});
		}
	);

	/**
	 * DELETE /api/notifications/fcm/unregister
	 * Unregister FCM token (logout/app uninstall)
	 */
	static unregisterFCMToken = asyncHandler(
		async (req: Request, res: Response) => {
			const { token } = req.body;

			if (!token) {
				throw ApiError.badRequest("FCM token is required");
			}

			const result = await NotificationService.unregisterFCMToken(token);

			res.json({
				success: true,
				...result,
			});
		}
	);

	/**
	 * POST /api/notifications/test
	 * Send test push notification (for debugging)
	 */
	static sendTestNotification = asyncHandler(
		async (req: Request, res: Response) => {
			const userId = req.user!.userId;

			const result = await NotificationService.sendPushNotification(userId, {
				title: "🎉 Test Notification",
				body: "Your push notifications are working correctly!",
				data: {
					type: "TEST",
					timestamp: new Date().toISOString(),
				},
			});

			res.json({
				success: true,
				message: "Test notification sent",
				...result,
			});
		}
	);
}
