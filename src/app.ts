import prisma from "@config/database";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "@middleware/errorHandler";
import { generalLimiter } from "@middleware/rateLimiter";
import routes from "@routes/index"; // Import main routes
import logger from "@utils/logger";

const app: Express = express();

// Security middleware
app.use(helmet());
app.use(
	cors({
		origin: "*",
		credentials: true,
	})
);

// Rate limiting
app.use(generalLimiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
	logger.info(`${req.method} ${req.path}`);
	next();
});

// Health check
app.get("/health", (req, res) => {
	res.json({
		status: "ok",
		timestamp: new Date().toISOString(),
	});
});

// Add before error handler
app.get("/api/test/db", async (req, res) => {
	try {
		await prisma.$queryRaw`SELECT 1`;
		res.json({ status: "Database connected ✅" });
	} catch (error) {
		res.status(500).json({ 
			status: "Database error ❌", 
			// @ts-ignore
			error: error.message 
		});
	}
});

// API routes
app.use("/api", routes); // ✅ Use centralized routes

// 404 handler
app.use((req, res) => {
	res.status(404).json({
		success: false,
		message: "Route not found",
	});
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
