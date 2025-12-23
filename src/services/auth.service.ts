import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "@config/database";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "@config/jwt";
import { ApiError } from "@utils/ApiError";
import { EmailService } from "./email.service";
import logger from "@utils/logger";

interface SignupData {
	email: string;
	password: string;
	role: "STUDENT" | "TEACHER";
	firstName: string;
	lastName: string;
	employeeId?: string;
	department?: string;
	phone?: string;
	//  REMOVED: studentId, batchId (students don't signup directly)
}

interface LoginResponse {
	accessToken: string;
	refreshToken: string;
	user: {
		id: string;
		email: string;
		role: string;
		emailVerified: boolean;
		name: string;
		identifier: string;
		phone?: string;
		employeeId?: string;
		studentId?: string;
		department?: string;
		batchId?: string;
		batchCode?: string;
	};
}

export class AuthService {
	/**
	 * User signup - TEACHERS ONLY
	 * Students are created via teacher import flow
	 */
	static async signup(data: SignupData) {
		const { email, password, role, firstName, lastName } = data;

		//  CRITICAL: Block student signup entirely
		if (role === "STUDENT") {
			throw ApiError.forbidden(
				"Student accounts are managed by teachers. " +
					"If you're a student, please contact your teacher for account creation. " +
					"If you already have credentials, use the login page instead."
			);
		}

		// Teacher-specific validation
		if (role === "TEACHER") {
			if (!data.employeeId) {
				throw ApiError.badRequest("Employee ID is required for teachers");
			}

			const existingTeacher = await prisma.teacher.findUnique({
				where: { employeeId: data.employeeId },
			});

			if (existingTeacher) {
				throw ApiError.badRequest("Employee ID already registered");
			}
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Generate verification token
		const verificationToken = crypto.randomBytes(32).toString("hex");
		const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

		// Create teacher account in transaction
		const user = await prisma.$transaction(async (tx) => {
			const newUser = await tx.user.create({
				data: {
					email,
					password: hashedPassword,
					role,
					verificationToken,
					verificationExpires,
				},
			});

			// Only teachers can signup
			await tx.teacher.create({
				data: {
					userId: newUser.id,
					employeeId: data.employeeId!,
					firstName,
					lastName,
					department: data.department,
					phone: data.phone,
				},
			});

			return newUser;
		});

		// Send verification email
		try {
			await EmailService.sendVerificationEmail(
				email,
				firstName,
				verificationToken
			);
		} catch (error) {
			logger.error("Failed to send verification email:", error);
			// Don't throw - user created, email can be resent
		}

		logger.info(`Teacher signed up: ${email}`);

		return {
			message:
				"Teacher account created successfully! Please check your email to verify your account.",
			user: {
				id: user.id,
				email: user.email,
				role: user.role,
			},
		};
	}

	/**
	 * User login - BOTH teachers and students
	 */
	static async login(email: string, password: string): Promise<LoginResponse> {
		// Find user with profile and batch info
		const user = await prisma.user.findUnique({
			where: { email },
			include: {
				student: {
					include: {
						batch: {
							include: {
								subjectEnrollments: {
									// Changed from 'subject' to 'subjectEnrollments'
									include: {
										subject: {
											select: {
												id: true,
												code: true,
												name: true,
												department: true,
												semester: true,
											},
										},
										teacher: {
											select: {
												id: true,
												firstName: true,
												lastName: true,
												employeeId: true,
											},
										},
									},
								},
							},
						},
					},
				},
				teacher: true,
			},
		});

		if (!user) {
			throw ApiError.unauthorized("Invalid email or password");
		}

		// Verify password
		const isValidPassword = await bcrypt.compare(password, user.password);
		if (!isValidPassword) {
			throw ApiError.unauthorized("Invalid email or password");
		}

		// Check email verification
		if (!user.emailVerified) {
			throw ApiError.forbidden(
				"Please verify your email before logging in. Check your inbox for the verification link."
			);
		}

		// Get profile info based on role
		let name = "";
		let identifier = "";
		let batchId: string | undefined;
		let batchCode: string | undefined;

		if (user.role === "STUDENT") {
			if (!user.student) {
				throw ApiError.internal("Student profile not found");
			}

			name = `${user.student.firstName} ${user.student.lastName}`;
			identifier = user.student.studentId;

			// Validate batch assignment
			if (!user.student.batch) {
				throw ApiError.forbidden(
					"Your account is not assigned to a batch yet. " +
						"Please contact your teacher to complete your enrollment."
				);
			}

			batchId = user.student.batch.id;
			batchCode = user.student.batch.code;

			logger.info(`Student logged in: ${identifier} (${batchCode})`);
		} else if (user.role === "TEACHER") {
			if (!user.teacher) {
				throw ApiError.internal("Teacher profile not found");
			}

			name = `${user.teacher.firstName} ${user.teacher.lastName}`;
			identifier = user.teacher.employeeId;

			logger.info(`Teacher logged in: ${identifier}`);
		}

		// Generate tokens
		const accessToken = generateAccessToken({
			userId: user.id,
			email: user.email,
			role: user.role,
			identifier,
		});

		const refreshToken = generateRefreshToken(user.id);

		// Store refresh token (cleanup old tokens first)
		await prisma.$transaction(async (tx) => {
			// Delete expired tokens
			await tx.refreshToken.deleteMany({
				where: {
					OR: [
						{ userId: user.id, expiresAt: { lt: new Date() } },
						{
							userId: user.id,
							createdAt: {
								lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
							},
						}, // Older than 30 days
					],
				},
			});

			// Create new token
			await tx.refreshToken.create({
				data: {
					userId: user.id,
					token: refreshToken,
					expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
				},
			});
		});

		return {
			accessToken,
			refreshToken,
			user: {
				id: user.id,
				email: user.email,
				role: user.role,
				emailVerified: user.emailVerified,
				name,
				identifier,
				phone:
					user.role === "STUDENT"
						? user.student?.phone ?? undefined
						: user.teacher?.phone ?? undefined,
				employeeId:
					user.role === "TEACHER"
						? user.teacher?.employeeId ?? undefined
						: undefined,
				studentId:
					user.role === "STUDENT" ? user.student?.studentId : undefined,
				department:
					user.role === "TEACHER"
						? user.teacher?.department ?? undefined
						: undefined,
				batchId,
				batchCode,
			},
		};
	}

	/**
	 * Verify email
	 */
	static async verifyEmail(token: string) {
		const user = await prisma.user.findFirst({
			where: {
				verificationToken: token,
				verificationExpires: { gt: new Date() },
				emailVerified: false,
			},
		});

		if (!user) {
			throw ApiError.badRequest(
				"Invalid or expired verification token. Please request a new one."
			);
		}

		await prisma.user.update({
			where: { id: user.id },
			data: {
				emailVerified: true,
				verificationToken: null,
				verificationExpires: null,
			},
		});

		logger.info(`Email verified: ${user.email}`);

		return {
			message: "Email verified successfully! You can now log in.",
		};
	}

	/**
	 * Resend verification email
	 */
	static async resendVerification(email: string) {
		const user = await prisma.user.findUnique({
			where: { email },
			include: {
				student: true,
				teacher: true,
			},
		});

		if (!user) {
			// Don't reveal if email exists (security)
			return {
				message: "If that email exists, a verification link has been sent.",
			};
		}

		if (user.emailVerified) {
			throw ApiError.badRequest("Email is already verified. Please login.");
		}

		// Generate new token
		const verificationToken = crypto.randomBytes(32).toString("hex");
		const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

		await prisma.user.update({
			where: { id: user.id },
			data: { verificationToken, verificationExpires },
		});

		// Get first name
		const firstName =
			user.student?.firstName || user.teacher?.firstName || "User";

		// Send email
		await EmailService.sendVerificationEmail(
			email,
			firstName,
			verificationToken
		);

		logger.info(`Verification email resent: ${email}`);

		return {
			message: "Verification email sent. Please check your inbox.",
		};
	}

	/**
	 * Logout - Invalidate refresh token
	 */
	static async logout(userId: string, refreshToken: string) {
		await prisma.refreshToken.deleteMany({
			where: {
				userId,
				token: refreshToken,
			},
		});

		logger.info(`User logged out: ${userId}`);

		return {
			message: "Logged out successfully",
		};
	}

	// ...existing code...

	/**
	 * Refresh access token using refresh token
	 */
	static async refreshToken(refreshToken: string) {
		try {
			const decoded = verifyRefreshToken(refreshToken);

			const storedToken = await prisma.refreshToken.findFirst({
				where: {
					userId: decoded.userId,
					token: refreshToken,
					expiresAt: { gt: new Date() },
				},
			});

			if (!storedToken) {
				throw ApiError.unauthorized("Invalid or expired refresh token");
			}

			const user = await prisma.user.findUnique({
				where: { id: decoded.userId },
			});

			if (!user) {
				throw ApiError.unauthorized("User not found");
			}

			const accessToken = generateAccessToken({
				userId: user.id,
				email: user.email,
				role: user.role,
			});

			return {
				accessToken,
				refreshToken, // Return same refresh token or generate new one if needed
			};
		} catch (error) {
			throw ApiError.unauthorized("Invalid or expired refresh token");
		}
	}
}
