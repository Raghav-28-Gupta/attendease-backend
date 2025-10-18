import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 5, // 5 requests per windowMs
	message: "Too many attempts, please try again later",
	standardHeaders: true,
	legacyHeaders: false,
});

export const generalLimiter = rateLimit({
	windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"),
	max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
	message: "Too many requests, please try again later",
	standardHeaders: true,
	legacyHeaders: false,
});
