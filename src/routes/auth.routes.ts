import { Router } from "express";
import { AuthController } from "@controllers/auth.controller";
import { validate } from "@middleware/validator";
import { authLimiter } from "@middleware/rateLimiter";
import {
	signupSchema,
	loginSchema,
	verifyEmailSchema,
} from "@utils/validators";

const router = Router();

// POST /api/auth/signup
router.post(
	"/signup",
	authLimiter,
	validate(signupSchema),
	AuthController.signup
);

// POST /api/auth/login
router.post("/login", authLimiter, validate(loginSchema), AuthController.login);

// GET /api/auth/verify-email?token=xxx
router.get(
	"/verify-email",
	validate(verifyEmailSchema),
	AuthController.verifyEmail
);

// POST /api/auth/resend-verification
router.post(
	"/resend-verification",
	authLimiter,
	AuthController.resendVerification
);

// POST /api/auth/logout
router.post("/logout", AuthController.logout);

export default router;
