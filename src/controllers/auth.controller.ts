import type { Request, Response } from "express";
import { AuthService } from "@services/auth.service";
import { asyncHandler } from "@utils/asyncHandler";

export class AuthController {
	static signup = asyncHandler(async (req: Request, res: Response) => {
		const result = await AuthService.signup(req.body);

		res.status(201).json({
			success: true,
			...result,
		});
	});

	static login = asyncHandler(async (req: Request, res: Response) => {
		const { email, password } = req.body;
		const result = await AuthService.login(email, password);

		res.json({
			success: true,
			message: "Login successful",
			...result,
		});
	});

	static verifyEmail = asyncHandler(async (req: Request, res: Response) => {
		const { token } = req.query;
		const result = await AuthService.verifyEmail(token as string);

		res.json({
			success: true,
			...result,
		});
	});

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

	static logout = asyncHandler(async (req: Request, res: Response) => {
		// Token is stateless, just send success
		// Client should delete token from storage
		res.json({
			success: true,
			message: "Logged out successfully",
		});
	});
}
