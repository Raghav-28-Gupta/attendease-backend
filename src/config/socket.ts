import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyAccessToken } from "@config/jwt";
import logger from "@utils/logger";
import prisma from "@config/database";

let io: SocketIOServer;

export const initializeSocket = (httpServer: HTTPServer) => {
	io = new SocketIOServer(httpServer, {
		cors: {
			origin: "*",
			credentials: true,
		},
	});

	// Authentication middleware
	io.use(async (socket: Socket, next) => {
		try {
			// Prefer Socket.IO auth payload
			let token: string | undefined = (socket.handshake as any).auth?.token;

			// Fallback 1: Postman may send auth as a query param (JSON encoded)
			if (!token) {
				const q = (socket.handshake.query as any).auth || (socket.handshake.query as any).token;
				if (q) {
					try {
						// q may be a JSON string like '{"token":"..."}' or raw token
						const parsed = typeof q === "string" && q.trim().startsWith("{") ? JSON.parse(q): q;
						token = parsed?.token ?? parsed;
					} catch (e) {
						token = q;
					}
				}
			}

			// Fallback 2: Authorization header (Bearer ...)
			if (!token) {
				const hdr = (socket.handshake as any).headers?.authorization;
				if (typeof hdr === "string" && hdr.startsWith("Bearer ")) {
					token = hdr.split(" ")[1];
				}
			}

			if (!token) {
				return next(new Error("Authentication token required"));
			}

			let decoded;
			try {
				decoded = verifyAccessToken(token);
			} catch (err) {
				// ✅ Check if token is expired
				if (err instanceof Error && err.name === 'TokenExpiredError') {
					logger.warn(`Expired token for socket connection`);
					return next(new Error("Token expired - please refresh"));
				}
				logger.error("Token verification failed:", err);
				return next(new Error("Invalid token"));
			}

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
				logger.info(`Student joined batch room: batch:${student.batchId}`);
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

		socket.on("join-room", (data: { room: string }) => {
			try {
				socket.join(data.room);
				logger.info(`Socket ${socket.id} joined room: ${data.room}`);
			} catch (error) {
				logger.error(`Failed to join room ${data.room}:`, error);
			}
		});

		socket.on("leave-room", (data: { room: string }) => {
			try {
				socket.leave(data.room);
				logger.info(`Socket ${socket.id} left room: ${data.room}`);
			} catch (error) {
				logger.error(`Failed to leave room ${data.room}:`, error);
			}
		});

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
