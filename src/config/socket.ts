import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyAccessToken } from "@config/jwt";
import logger from "@utils/logger";
import prisma from "@config/database";

let io: SocketIOServer;

export const initializeSocket = (httpServer: HTTPServer) => {
	io = new SocketIOServer(httpServer, {
		cors: {
			origin: process.env.FRONTEND_URL || "http://localhost:3000",
			credentials: true,
		},
	});

	// Authentication middleware
	io.use(async (socket: Socket, next) => {
		try {
			const token = socket.handshake.auth.token;

			if (!token) {
				return next(new Error("Authentication token required"));
			}

			const decoded = verifyAccessToken(token);

			if (!decoded) {
				return next(new Error("Invalid token"));
			}

			// Attach user info to socket
			(socket as any).user = decoded;

			logger.info(
				`Socket authenticated: ${decoded.email} (${decoded.role})`
			);

			next();
		} catch (error) {
			logger.error("Socket authentication failed:", error);
			next(new Error("Authentication failed"));
		}
	});

	// Connection handler
	io.on("connection", async (socket: Socket) => {
		const user = (socket as any).user;

		logger.info(`Socket connected: ${socket.id} - ${user.email}`);

		// Join user-specific room
		socket.join(`user:${user.userId}`);

		if (user.role === "STUDENT") {
			// Get student's batch and join batch room
			const student = await prisma.student.findUnique({
				where: { userId: user.userId },
				select: { batchId: true },
			});

			if (student?.batchId) {
				socket.join(`batch:${student.batchId}`);
				logger.info(
					`Student joined batch room: batch:${student.batchId}`
				);
			}
		} else if (user.role === "TEACHER") {
			// Get teacher's enrollments and join subject rooms
			const teacher = await prisma.teacher.findUnique({
				where: { userId: user.userId },
				include: {
					subjectEnrollments: {
						select: {
							id: true,
							subjectId: true,
							batchId: true,
						},
					},
				},
			});

			if (teacher) {
				teacher.subjectEnrollments.forEach((enrollment) => {
					socket.join(`enrollment:${enrollment.id}`);
				});
				logger.info(
					`Teacher joined ${teacher.subjectEnrollments.length} enrollment rooms`
				);
			}
		}

		// Disconnect handler
		socket.on("disconnect", () => {
			logger.info(`Socket disconnected: ${socket.id}`);
		});

		// Error handler
		socket.on("error", (error) => {
			logger.error(`Socket error: ${socket.id}`, error);
		});
	});

	logger.info("WebSocket server initialized");

	return io;
};

export const getIO = (): SocketIOServer => {
	if (!io) {
		throw new Error("Socket.IO not initialized");
	}
	return io;
};
