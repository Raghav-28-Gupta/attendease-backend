import type { Request, Response } from "express";
import { AuthService } from "@services/auth.service";
import { asyncHandler } from "@utils/asyncHandler";

export class AuthController {
	/**
	 * POST /api/auth/signup
	 * Teacher signup only
	 */
	static signup = asyncHandler(async (req: Request, res: Response) => {
		const result = await AuthService.signup(req.body);

		res.status(201).json({
			success: true,
			...result,
		});
	});

	/**
	 * POST /api/auth/login
	 * Both teachers and students
	 */
	static login = asyncHandler(async (req: Request, res: Response) => {
		const { email, password } = req.body;
		const result = await AuthService.login(email, password);

		res.json({
			success: true,
			message: "Login successful",
			...result,
		});
	});

	/**
	 * GET /api/auth/verify-email?token=xxx
	 */
	static verifyEmail = asyncHandler(async (req: Request, res: Response) => {
		const { token } = req.query;
		const result = await AuthService.verifyEmail(token as string);

		res.json({
			success: true,
			...result,
		});
	});

	/**
	 * POST /api/auth/resend-verification
	 */
	static resendVerification = asyncHandler(
		async (req: Request, res: Response) => {
			const { email } = req.body;
			const result = await AuthService.resendVerification(email);

			res.json({
				success: true,
				...result,
			});
		}
	);

	/**
	 * POST /api/auth/logout
	 */
	static logout = asyncHandler(async (req: Request, res: Response) => {
		const userId = req.user!.userId;
		const { refreshToken } = req.body;

		const result = await AuthService.logout(userId, refreshToken);

		res.json({
			success: true,
			...result,
		});
	});

	/**
     * POST /api/auth/refresh-token
     */
	static refreshToken = asyncHandler(async (req: Request, res: Response) => {
		const { refreshToken } = req.body;
		const result = await AuthService.refreshToken(refreshToken);

		res.json({
			success: true,
			...result,
		});
	});
}
