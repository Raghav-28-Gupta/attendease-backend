import { Server } from "http";
import app from "./app";
import logger from "@utils/logger";
import prisma from "@config/database";

const PORT = process.env.PORT || 5000;

let server: Server | null = null;

const startServer = async () => {
	try {
		// Test database connection
		await prisma.$connect();
		logger.info("✅ Database connected");

		// Start HTTP server
		server = app.listen(PORT, () => {
			logger.info(`✅ Server running on http://localhost:${PORT}`);
			logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
		});
	} catch (error) {
		logger.error("Failed to start server:", error);
		process.exit(1);
	}
};

// Graceful shutdown
const gracefulShutdown = async () => {
	logger.info("Shutting down gracefully...");

	if (server) {
		server.close(() => {
			logger.info("HTTP server closed");
		});
	}

	await prisma.$disconnect();
	logger.info("Database disconnected");

	process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Start server
startServer();

export default server;
