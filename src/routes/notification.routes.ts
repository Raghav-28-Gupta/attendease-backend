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

// ==================== STUDENT ROUTES ====================

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

// ==================== TEACHER ROUTES ====================

/**
 * POST /api/notifications/fcm/teacher/register
 * Register FCM token (teachers only)
 */
router.post(
	"/fcm/teacher/register",
	authorize("TEACHER"),
	validate(registerFCMSchema),
	NotificationController.registerTeacherFCMToken
);

/**
 * GET /api/notifications/teacher/today-classes
 * Get today's classes for scheduling reminders
 */
router.get(
	"/teacher/today-classes",
	authorize("TEACHER"),
	NotificationController.getTodayClassesForReminder
);

/**
 * POST /api/notifications/teacher/test
 * Send test notification to teacher (for debugging)
 */
router.post(
	"/teacher/test",
	authorize("TEACHER"),
	NotificationController.sendTeacherTestNotification
);

export default router;
