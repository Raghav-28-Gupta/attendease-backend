import http from "http";
import app from "./app";
import { initializeSocket } from "@config/socket";
import logger from "@utils/logger";
import prisma from "@config/database";

const PORT = process.env.PORT || 5000;

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize WebSocket
initializeSocket(httpServer);

const startServer = async () => {
	try {
		// Test database connection
		await prisma.$connect();
		logger.info("✅ Database connected");

		// Start HTTP server with WebSocket support
		httpServer.listen(PORT, () => {
			logger.info(`🚀 Server running on ${process.env.BACKEND_URL}`);
			logger.info(`📡 WebSocket server ready`);
			logger.info(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
		});
	} catch (error) {
		logger.error("❌ Failed to start server:", error);
		process.exit(1);
	}
};

// Graceful shutdown
const gracefulShutdown = async () => {
	logger.info("⏳ Shutting down gracefully...");

	// Close HTTP server (this also closes WebSocket connections)
	httpServer.close(() => {
		logger.info("✅ HTTP server closed");
	});

	// Disconnect from database
	await prisma.$disconnect();
	logger.info("✅ Database disconnected");

	process.exit(0);
};

// Handle shutdown signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Handle uncaught errors
process.on("unhandledRejection", (reason, promise) => {
	logger.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
	gracefulShutdown();
});

process.on("uncaughtException", (error) => {
	logger.error("❌ Uncaught Exception:", error);
	gracefulShutdown();
});

// Start server
startServer();

export default httpServer;
