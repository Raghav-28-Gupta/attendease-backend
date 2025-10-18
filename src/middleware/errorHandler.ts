import type { Request, Response, NextFunction } from "express";
import { ApiError } from "@utils/ApiError";
import logger from "@utils/logger";

export const errorHandler = (
	err: Error,
	req: Request,
	res: Response,
	next: NextFunction
) => {
	logger.error("Error:", {
		message: err.message,
		stack: err.stack,
		path: req.path,
		method: req.method,
	});

	if (err instanceof ApiError) {
		return res.status(err.statusCode).json({
			success: false,
			message: err.message,
			...(process.env.NODE_ENV === "development" && { stack: err.stack }),
		});
	}

	// Prisma errors
	if (err.name === "PrismaClientKnownRequestError") {
		const prismaError = err as any;

		if (prismaError.code === "P2002") {
			return res.status(409).json({
				success: false,
				message: "A record with this value already exists",
				field: prismaError.meta?.target,
			});
		}

		if (prismaError.code === "P2025") {
			return res.status(404).json({
				success: false,
				message: "Record not found",
			});
		}
	}

	// JWT errors
	if (err.name === "JsonWebTokenError") {
		return res.status(401).json({
			success: false,
			message: "Invalid token",
		});
	}

	if (err.name === "TokenExpiredError") {
		return res.status(401).json({
			success: false,
			message: "Token expired",
		});
	}

	// Default error
	res.status(500).json({
		success: false,
		message: "Internal server error",
		...(process.env.NODE_ENV === "development" && {
			error: err.message,
			stack: err.stack,
		}),
	});
};
