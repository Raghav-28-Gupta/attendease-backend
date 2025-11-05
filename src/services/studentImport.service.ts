import prisma from "@config/database";
import { ApiError } from "@utils/ApiError";
import logger from "@utils/logger";
import type { ImportStudentDTO } from "@local-types/models.types";
import { csvStudentSchema } from "@utils/validators";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { EmailService } from "./email.service";

interface ImportResult {
	successful: number;
	failed: number;
	errors: {
		row: number;
		studentId: string;
		error: string;
	}[];
	students: {
		id: string;
		studentId: string;
		name: string;
		email: string;
	}[];
}

export class StudentImportService {
	/**
	 * Parse CSV data into student objects
	 */
	static parseCSV(csvContent: string): ImportStudentDTO[] {
		const lines = csvContent.trim().split("\n");

		if (lines.length < 2) {
			throw ApiError.badRequest(
				"CSV file must contain header and at least one student"
			);
		}

		const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());

		const requiredHeaders = [
			"student_id",
			"first_name",
			"last_name",
			"email",
		];
		const alternativeHeaders = [
			"studentid",
			"firstname",
			"lastname",
			"email",
		];

		const hasRequiredHeaders = requiredHeaders.every((h) =>
			headers.includes(h)
		);
		const hasAlternativeHeaders = alternativeHeaders.every((h) =>
			headers.includes(h)
		);

		if (!hasRequiredHeaders && !hasAlternativeHeaders) {
			throw ApiError.badRequest(
				`Missing required columns. Expected: student_id, first_name, last_name, email`
			);
		}

		const columnMap: Record<string, string> = {
			student_id: "studentId",
			studentid: "studentId",
			first_name: "firstName",
			firstname: "firstName",
			last_name: "lastName",
			lastname: "lastName",
			email: "email",
			phone: "phone",
		};

		const students: ImportStudentDTO[] = [];

		for (let i = 1; i < lines.length; i++) {
			const line = lines[i]?.trim();
			if (!line) continue;

			const values = line.split(",").map((v) => v.trim());
			const student: any = {};

			headers.forEach((header, index) => {
				const mappedKey = columnMap[header];
				if (mappedKey && values[index]) {
					student[mappedKey] = values[index];
				}
			});

			// Validate required fields
			if (
				student.studentId &&
				student.firstName &&
				student.lastName &&
				student.email
			) {
				students.push(student as ImportStudentDTO);
			}
		}

		return students;
	}

	/**
	 * Import students to batch from CSV
	 */
	static async importStudentsToBatch(
		batchId: string,
		teacherUserId: string, // ✅ Keep teacher parameter for authorization
		students: ImportStudentDTO[]
	): Promise<ImportResult> {
		// ✅ Verify teacher teaches this batch (via SubjectEnrollment)
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		// ✅ Check if teacher has any subject enrollments with this batch
		const enrollment = await prisma.subjectEnrollment.findFirst({
			where: {
				batchId,
				teacherId: teacher.id,
				status: "ACTIVE",
			},
			include: {
				batch: true,
				subject: true,
				teacher: true,
			},
		});

		if (!enrollment) {
			throw ApiError.forbidden(
				"You do not teach any subjects to this batch"
			);
		}

		const batch = enrollment.batch;

		// Check capacity
		const currentCount = await prisma.student.count({
			where: { batchId },
		});

		if (batch.capacity && currentCount + students.length > batch.capacity) {
			throw ApiError.badRequest(
				`Batch capacity exceeded. Current: ${currentCount}, Capacity: ${batch.capacity}, Trying to add: ${students.length}`
			);
		}

		const result: ImportResult = {
			successful: 0,
			failed: 0,
			errors: [],
			students: [],
		};

		// Process each student
		for (let i = 0; i < students.length; i++) {
			const studentData = students[i];
			if (!studentData) {
				throw new Error("Student data is undefined");
			}
			const rowNumber = i + 2;

			try {
				// Validate data
				csvStudentSchema.parse(studentData);

				// Check duplicates
				const existingStudent = await prisma.student.findUnique({
					where: { studentId: studentData.studentId },
				});

				if (existingStudent) {
					result.failed++;
					result.errors.push({
						row: rowNumber,
						studentId: studentData.studentId,
						error: "Student ID already exists",
					});
					continue;
				}

				const existingUser = await prisma.user.findUnique({
					where: { email: studentData.email },
				});

				if (existingUser) {
					result.failed++;
					result.errors.push({
						row: rowNumber,
						studentId: studentData.studentId,
						error: "Email already registered",
					});
					continue;
				}

				// Generate temporary password
				const tempPassword = crypto.randomBytes(8).toString("hex");
				const hashedPassword = await bcrypt.hash(tempPassword, 10);

				// Generate verification token
				const verificationToken = crypto.randomBytes(32).toString("hex");
				const verificationExpires = new Date(
					Date.now() + 24 * 60 * 60 * 1000
				);

				// Create user and student in transaction
				const newStudent = await prisma.$transaction(async (tx) => {
					const user = await tx.user.create({
						data: {
							email: studentData.email,
							password: hashedPassword,
							role: "STUDENT",
							verificationToken,
							verificationExpires,
							emailVerified: false,
						},
					});

					const student = await tx.student.create({
						data: {
							userId: user.id,
							studentId: studentData.studentId,
							firstName: studentData.firstName,
							lastName: studentData.lastName,
							phone: studentData.phone || null,
							batchId: batchId,
						},
					});

					return { user, student };
				});

				// ✅ Send welcome email with enrollment context
				try {
					await this.sendWelcomeEmail(
						studentData.email,
						studentData.firstName,
						studentData.studentId,
						tempPassword,
						verificationToken,
						batch.code,
						batch.name,
						enrollment.subject.name, // ✅ Which subject
						`${enrollment.teacher.firstName} ${enrollment.teacher.lastName}` // ✅ Which teacher
					);
				} catch (emailError) {
					logger.error(
						`Failed to send email to ${studentData.email}:`,
						emailError
					);
				}

				result.successful++;
				result.students.push({
					id: newStudent.student.id,
					studentId: studentData.studentId,
					name: `${studentData.firstName} ${studentData.lastName}`,
					email: studentData.email,
				});

				logger.info(
					`Student imported: ${studentData.studentId} to batch ${batch.code} by teacher ${teacher.employeeId}`
				);
			} catch (error: any) {
				result.failed++;
				result.errors.push({
					row: rowNumber,
					studentId: studentData.studentId,
					error: error.message || "Unknown error",
				});
			}
		}

		logger.info(
			`Batch import completed: ${result.successful} successful, ${result.failed} failed`
		);

		return result;
	}

	/**
	 * Send welcome email to newly imported student
	 */
	private static async sendWelcomeEmail(
		email: string,
		firstName: string,
		studentId: string,
		tempPassword: string,
		verificationToken: string,
		batchCode: string,
		batchName: string,
		subjectName: string, // ✅ Added subject context
		teacherName: string // ✅ Added teacher context
	): Promise<void> {
		const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
		const loginUrl = `${process.env.FRONTEND_URL}/login`;

		const mailOptions = {
			from: process.env.EMAIL_FROM,
			to: email,
			subject: `Welcome to AttendEase - ${subjectName} (${batchCode})`,
			html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Welcome to AttendEase, ${firstName}! 🎓</h2>
        
        <p>Your teacher <strong>${teacherName}</strong> has enrolled you in <strong>${subjectName}</strong> for batch <strong>${batchName} (${batchCode})</strong>.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">📝 Your Login Credentials</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0;"><strong>Student ID:</strong></td>
              <td style="padding: 8px 0;"><code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px;">${studentId}</code></td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Email:</strong></td>
              <td style="padding: 8px 0;"><code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px;">${email}</code></td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Batch:</strong></td>
              <td style="padding: 8px 0;"><strong>${batchCode}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Subject:</strong></td>
              <td style="padding: 8px 0;">${subjectName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Teacher:</strong></td>
              <td style="padding: 8px 0;">${teacherName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Temporary Password:</strong></td>
              <td style="padding: 8px 0;"><code style="background: #fff3cd; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${tempPassword}</code></td>
            </tr>
          </table>
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
          <strong>⚠️ Important Security Steps:</strong>
          <ol style="margin: 10px 0; padding-left: 20px;">
            <li>Verify your email first (button below)</li>
            <li>Login with the temporary password</li>
            <li><strong>Change your password immediately</strong> after first login</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #28a745; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            ✅ Verify Email Address
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">Or copy this link:</p>
        <p style="color: #666; font-size: 12px; word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 4px;">
          ${verificationUrl}
        </p>
        
        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
        
        <div style="background-color: #e7f3ff; padding: 15px; border-radius: 6px;">
          <p style="margin: 0;"><strong>📱 After Email Verification:</strong></p>
          <p style="margin: 10px 0;">Login at: <a href="${loginUrl}">${loginUrl}</a></p>
          <p style="margin: 0; font-size: 14px; color: #666;">Use your email and the temporary password above</p>
        </div>
        
        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
          This is an automated email from AttendEase. If you believe this is a mistake, please contact your teacher.
        </p>
      </div>
    `,
		};

		await EmailService.sendEmail(mailOptions);
	}

	/**
	 * Add single student manually to batch
	 */
	static async addSingleStudent(
		batchId: string,
		teacherUserId: string, // ✅ Keep authorization
		data: ImportStudentDTO & { password: string }
	) {
		// ✅ Verify teacher authorization
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		const enrollment = await prisma.subjectEnrollment.findFirst({
			where: {
				batchId,
				teacherId: teacher.id,
				status: "ACTIVE",
			},
			include: {
				batch: true,
				subject: true,
			},
		});

		if (!enrollment) {
			throw ApiError.forbidden(
				"You do not teach any subjects to this batch"
			);
		}

		const batch = enrollment.batch;

		// Check capacity
		const currentCount = await prisma.student.count({
			where: { batchId },
		});

		if (batch.capacity && currentCount >= batch.capacity) {
			throw ApiError.badRequest("Batch capacity reached");
		}

		// Check duplicates
		const existingStudent = await prisma.student.findUnique({
			where: { studentId: data.studentId },
		});

		if (existingStudent) {
			throw ApiError.badRequest("Student ID already exists");
		}

		const existingUser = await prisma.user.findUnique({
			where: { email: data.email },
		});

		if (existingUser) {
			throw ApiError.badRequest("Email already registered");
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(data.password, 10);
		const verificationToken = crypto.randomBytes(32).toString("hex");
		const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

		// Create student
		const newStudent = await prisma.$transaction(async (tx) => {
			const user = await tx.user.create({
				data: {
					email: data.email,
					password: hashedPassword,
					role: "STUDENT",
					verificationToken,
					verificationExpires,
				},
			});

			const student = await tx.student.create({
				data: {
					userId: user.id,
					studentId: data.studentId,
					firstName: data.firstName,
					lastName: data.lastName,
					phone: data.phone,
					batchId: batchId,
				},
				include: {
					batch: true,
				},
			});

			return { user, student };
		});

		// Send verification email
		await EmailService.sendVerificationEmail(
			data.email,
			data.firstName,
			verificationToken
		);

		logger.info(
			`Student added manually: ${data.studentId} to batch ${batch.code}`
		);

		return newStudent.student;
	}

	/**
	 * Remove student from batch
	 */
	static async removeStudentFromBatch(
		batchId: string,
		studentId: string,
		teacherUserId: string // ✅ Keep authorization
	) {
		// ✅ Verify teacher authorization
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		const enrollment = await prisma.subjectEnrollment.findFirst({
			where: {
				batchId,
				teacherId: teacher.id,
				status: "ACTIVE",
			},
			include: {
				batch: true,
			},
		});

		if (!enrollment) {
			throw ApiError.forbidden(
				"You do not teach any subjects to this batch"
			);
		}

		const batch = enrollment.batch;

		// Find student
		const student = await prisma.student.findUnique({
			where: { id: studentId },
		});

		if (!student || student.batchId !== batchId) {
			throw ApiError.notFound("Student not found in this batch");
		}

		// Check if student has attendance records
		const attendanceCount = await prisma.attendanceRecord.count({
			where: { studentId: student.id },
		});

		if (attendanceCount > 0) {
			throw ApiError.badRequest(
				`Cannot remove student with ${attendanceCount} attendance records. Consider dropping enrollment instead.`
			);
		}

		// Delete student (cascades to user)
		await prisma.student.delete({
			where: { id: studentId },
		});

		logger.info(
			`Student removed: ${student.studentId} from batch ${batch.code}`
		);

		return { message: "Student removed successfully" };
	}
}
