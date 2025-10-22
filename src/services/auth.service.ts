import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "@config/database";
import { generateAccessToken, generateRefreshToken } from "@config/jwt";
import { ApiError } from "@utils/ApiError";
import { EmailService } from "./email.service";
import logger from "@utils/logger";

interface SignupData {
	email: string;
	password: string;
	role: "STUDENT" | "TEACHER";
	firstName: string;
	lastName: string;
	studentId?: string;
	employeeId?: string;
	department?: string;
	phone?: string;
	batchId?: string; // Optional batchId for student signup
}

interface LoginResponse {
	accessToken: string;
	refreshToken: string;
	user: {
		id: string;
		email: string;
		role: string;
		name: string;
		identifier: string;
		batchId?: string; // Return batchId for students
		batchCode?: string; // Return batch code for display
	};
}

export class AuthService {
	static async signup(data: SignupData) {
		const { email, password, role, firstName, lastName } = data;

		// Check if email exists
		const existingUser = await prisma.user.findUnique({
			where: { email },
		});

		if (existingUser) {
			throw ApiError.badRequest("Email already registered");
		}

		// Check if identifier exists
		if (role === "STUDENT" && data.studentId) {
			const existingStudent = await prisma.student.findUnique({
				where: { studentId: data.studentId },
			});
			if (existingStudent) {
				throw ApiError.badRequest("Student ID already registered");
			}

			// Validate batchId if provided
			if (data.batchId) {
				const batchExists = await prisma.batch.findUnique({
					where: { id: data.batchId },
				});
				if (!batchExists) {
					throw ApiError.badRequest("Invalid batch ID");
				}
			} else {
				// IMPORTANT: Students can signup without batch initially
				// They will be assigned to batch later by teacher during import
				// This allows pre-registration before teacher creates batches
				logger.warn(
					`Student ${data.studentId} signing up without batch assignment`
				);
			}
		}

		if (role === "TEACHER" && data.employeeId) {
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
		const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

		// Create user with profile in transaction
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

			if (role === "STUDENT") {
				// Handle optional batchId
				if (!data.batchId) {
					// Create student WITHOUT batch (will be assigned later)
					// This requires making batchId nullable in schema temporarily
					// OR we create a "UNASSIGNED" batch for each subject
					throw ApiError.badRequest(
						"Students must be imported by teacher with batch assignment. Direct signup is disabled."
					);
				}

				await tx.student.create({
					data: {
						userId: newUser.id,
						studentId: data.studentId!,
						firstName,
						lastName,
						phone: data.phone,
						batchId: data.batchId, // Required now
					},
				});
			} else if (role === "TEACHER") {
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
			}

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
			logger.error(
				"Failed to send verification email, but user created:",
				error
			);
			// Don't throw - user is created, email can be resent later
		}

		logger.info(`User signed up: ${email} (${role})`);

		return {
			message:
				"Signup successful! Please check your email to verify your account.",
			user: {
				id: user.id,
				email: user.email,
				role: user.role,
			},
		};
	}

	static async login(
		email: string,
		password: string
	): Promise<LoginResponse> {
		// Find user with profile (include batch for students)
		const user = await prisma.user.findUnique({
			where: { email },
			include: {
				student: {
					include: {
						batch: {
							include: {
								subject: true, // Include subject for batch info
							},
						},
					},
				},
				teacher: true,
			},
		});

		if (!user) {
			throw ApiError.unauthorized("Invalid credentials");
		}

		// Verify password
		const isValidPassword = await bcrypt.compare(password, user.password);
		if (!isValidPassword) {
			throw ApiError.unauthorized("Invalid credentials");
		}

		// Check email verification
		if (!user.emailVerified) {
			throw ApiError.forbidden(
				"Please verify your email before logging in"
			);
		}

		// Get profile info
		let name = "";
		let identifier = "";
		let batchId: string | undefined;
		let batchCode: string | undefined;

		if (user.role === "STUDENT" && user.student) {
			name = `${user.student.firstName} ${user.student.lastName}`;
			identifier = user.student.studentId;

			// Include batch information for students
			if (user.student.batch) {
				batchId = user.student.batch.id;
				batchCode = user.student.batch.code;
			} else {
				// tudent not assigned to batch yet
				logger.warn(
					`Student ${user.student.studentId} logged in without batch assignment`
				);
				throw ApiError.forbidden(
					"Your account is not assigned to a batch yet. Please contact your teacher."
				);
			}
		} else if (user.role === "TEACHER" && user.teacher) {
			name = `${user.teacher.firstName} ${user.teacher.lastName}`;
			identifier = user.teacher.employeeId;
		}

		// Generate tokens
		const accessToken = generateAccessToken({
			userId: user.id,
			email: user.email,
			role: user.role,
			identifier,
		});

		const refreshToken = generateRefreshToken(user.id);

		// Store refresh token
		await prisma.refreshToken.create({
			data: {
				userId: user.id,
				token: refreshToken,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
			},
		});

		logger.info(`User logged in: ${email}`);

		return {
			accessToken,
			refreshToken,
			user: {
				id: user.id,
				email: user.email,
				role: user.role,
				name,
				identifier,
				batchId, // Return for students
				batchCode, // Return for display (e.g., "CS301-A")
			},
		};
	}

	static async verifyEmail(token: string) {
		const user = await prisma.user.findFirst({
			where: {
				verificationToken: token,
				verificationExpires: { gt: new Date() },
				emailVerified: false,
			},
		});

		if (!user) {
			throw ApiError.badRequest("Invalid or expired verification token");
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

	static async resendVerification(email: string) {
		const user = await prisma.user.findUnique({
			where: { email },
			include: {
				student: true,
				teacher: true,
			},
		});

		if (!user) {
			// Don't reveal if email exists for security
			return {
				message:
					"If that email exists, verification link has been sent",
			};
		}

		if (user.emailVerified) {
			throw ApiError.badRequest("Email already verified");
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

		return { message: "Verification email sent" };
	}
}
