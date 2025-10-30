import { Router } from "express";
import { NotificationController } from "@controllers/notification.controller";
import { authenticate, authorize } from "@middleware/auth";
import { validate } from "@middleware/validator";
import { z } from "zod";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const registerFCMSchema = z.object({
	body: z.object({
		token: z.string().min(1, "FCM token is required"),
		deviceId: z.string().optional(),
	}),
});

const unregisterFCMSchema = z.object({
	body: z.object({
		token: z.string().min(1, "FCM token is required"),
	}),
});

/**
 * POST /api/notifications/fcm/register
 * Register FCM token (students only)
 */
router.post(
	"/fcm/register",
	authorize("STUDENT"),
	validate(registerFCMSchema),
	NotificationController.registerFCMToken
);

/**
 * DELETE /api/notifications/fcm/unregister
 * Unregister FCM token
 */
router.delete(
	"/fcm/unregister",
	authorize("STUDENT"),
	validate(unregisterFCMSchema),
	NotificationController.unregisterFCMToken
);

/**
 * POST /api/notifications/test
 * Send test notification (for debugging)
 */
router.post(
	"/test",
	authorize("STUDENT"),
	NotificationController.sendTestNotification
);

export default router;
