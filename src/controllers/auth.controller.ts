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
	 * Returns HTML page for browser-based verification
	 */
	static verifyEmail = async (req: Request, res: Response) => {
		const { token } = req.query;

		// HTML template helper
		const renderHtml = (
			title: string,
			message: string,
			success: boolean,
			subMessage?: string
		) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - AttendEase</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, ${
					success ? "#667eea 0%, #764ba2 100%" : "#f093fb 0%, #f5576c 100%"
				});
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px 30px;
            text-align: center;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            animation: fadeInUp 0.6s ease-out;
        }
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            background: ${
					success
						? "linear-gradient(135deg, #4ade80, #22c55e)"
						: "linear-gradient(135deg, #f87171, #ef4444)"
				};
            animation: ${
					success
						? "bounce 0.6s ease-out 0.3s"
						: "shake 0.6s ease-out 0.3s"
				};
        }
        @keyframes bounce {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        h1 {
            color: #1f2937;
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 12px;
        }
        .message {
            color: #4b5563;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        .sub-message {
            color: #6b7280;
            font-size: 14px;
            background: #f3f4f6;
            padding: 16px;
            border-radius: 12px;
            margin-bottom: 24px;
        }
        .app-prompt {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: #9ca3af;
            font-size: 14px;
            margin-top: 20px;
        }
        .app-prompt svg {
            width: 20px;
            height: 20px;
        }
        .logo {
            font-size: 28px;
            font-weight: 800;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">AttendEase</div>
        <div class="icon">${success ? "✓" : "✕"}</div>
        <h1>${title}</h1>
        <p class="message">${message}</p>
        ${subMessage ? `<div class="sub-message">${subMessage}</div>` : ""}
        <div class="app-prompt">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span>You can now close this page and return to the app</span>
        </div>
    </div>
</body>
</html>`;

		try {
			await AuthService.verifyEmail(token as string);

			res.setHeader("Content-Type", "text/html");
			res.send(
				renderHtml(
					"Email Verified!",
					"Your email has been successfully verified.",
					true,
					"🎉 You can now log in to the AttendEase app with your credentials."
				)
			);
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Invalid or expired verification token. Please request a new one.";

			res.setHeader("Content-Type", "text/html");
			res.status(400).send(
				renderHtml(
					"Verification Failed",
					errorMessage,
					false,
					"If this issue persists, please request a new verification email from the app."
				)
			);
		}
	};

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
