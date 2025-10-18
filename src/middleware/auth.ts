import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "@config/jwt";
import type { JWTPayload } from "@config/jwt";
import { ApiError } from "@utils/ApiError";
import { asyncHandler } from "@utils/asyncHandler";
import prisma from "@config/database";

// Extend Express Request type
declare global {
	namespace Express {
		interface Request {
			user?: JWTPayload;
		}
	}
}

export const authenticate = asyncHandler(
	async (req: Request, res: Response, next: NextFunction) => {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			throw ApiError.unauthorized("No token provided");
		}

		const token = authHeader.split(" ")[1];

		try {
			const decoded = verifyAccessToken(token!);

			// Verify user still exists
			const user = await prisma.user.findUnique({
				where: { id: decoded.userId! },
				select: {
					id: true,
					email: true,
					role: true,
					emailVerified: true,
				},
			});

			if (!user) {
				throw ApiError.unauthorized("User not found");
			}

			if (!user.emailVerified) {
				throw ApiError.forbidden("Please verify your email first");
			}

			req.user = decoded;
			next();
		} catch (error) {
			if (error instanceof ApiError) throw error;
			throw ApiError.unauthorized("Invalid or expired token");
		}
	}
);

export const authorize = (...allowedRoles: string[]) => {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!req.user) {
			throw ApiError.unauthorized("Not authenticated");
		}

		if (!allowedRoles.includes(req.user.role)) {
			throw ApiError.forbidden(
				`Access denied. Required role: ${allowedRoles.join(" or ")}`
			);
		}

		next();
	};
};
