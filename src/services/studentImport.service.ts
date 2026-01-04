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
		subjectName: string,
		teacherName: string
	): Promise<void> {
		const verificationUrl = `${process.env.BACKEND_URL}/api/auth/verify-email?token=${verificationToken}`;

		const mailOptions = {
			from: process.env.EMAIL_FROM,
			to: email,
			subject: `🎓 Welcome to AttendEase - Verify Your Email`,
			html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f2f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header with gradient -->
    <tr>
      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 40px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">🎓</div>
        <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">Welcome to AttendEase!</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 16px; font-weight: 400;">Your student account is ready</p>
      </td>
    </tr>

    <!-- Greeting -->
    <tr>
      <td style="padding: 40px 40px 0 40px;">
        <p style="color: #1a1a2e; font-size: 20px; margin: 0; font-weight: 600;">Hi ${firstName}! 👋</p>
        <p style="color: #4a5568; font-size: 16px; line-height: 1.7; margin: 16px 0 0 0;">
          <strong>${teacherName}</strong> has enrolled you in <strong style="color: #667eea;">${subjectName}</strong> 
          <span style="color: #718096;">(${batchCode})</span>
        </p>
      </td>
    </tr>

    <!-- Credentials Card -->
    <tr>
      <td style="padding: 30px 40px;">
        <div style="background: linear-gradient(145deg, #f7fafc 0%, #edf2f7 100%); border-radius: 16px; padding: 28px; border: 1px solid #e2e8f0;">
          <table cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td colspan="2" style="padding-bottom: 16px;">
                <span style="font-size: 20px;">🔐</span>
                <strong style="color: #2d3748; font-size: 18px; margin-left: 8px;">Your Login Credentials</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #718096; font-size: 14px; font-weight: 500; width: 100px;">EMAIL</td>
              <td style="padding: 12px 0;">
                <span style="background: #edf2f7; color: #2d3748; padding: 8px 14px; border-radius: 8px; font-size: 14px; font-weight: 600;">${email}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #718096; font-size: 14px; font-weight: 500;">PASSWORD</td>
              <td style="padding: 12px 0;">
                <span style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); color: #92400e; padding: 8px 14px; border-radius: 8px; font-size: 15px; font-weight: 700; letter-spacing: 0.5px;">${tempPassword}</span>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>

    <!-- Steps Section -->
    <tr>
      <td style="padding: 0 40px 30px 40px;">
        <div style="background: linear-gradient(145deg, #ebf8ff 0%, #e0f2fe 100%); border-radius: 16px; padding: 28px; border: 1px solid #bae6fd;">
          <table cellpadding="0" cellspacing="0" style="width: 100%;">
            <tr>
              <td colspan="2" style="padding-bottom: 16px;">
                <span style="font-size: 18px;">🚀</span>
                <strong style="color: #0369a1; font-size: 16px; margin-left: 8px;">Get Started in 2 Steps</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; vertical-align: top; width: 40px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-size: 14px; font-weight: 700;">1</div>
              </td>
              <td style="padding: 10px 0;">
                <p style="margin: 0; color: #1e40af; font-size: 15px; font-weight: 600;">Verify your email</p>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Click the button below to confirm your email</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 0; vertical-align: top;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px; font-size: 14px; font-weight: 700;">2</div>
              </td>
              <td style="padding: 10px 0;">
                <p style="margin: 0; color: #1e40af; font-size: 15px; font-weight: 600;">Login in the AttendEase app</p>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Open the app and use your credentials above</p>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>

    <!-- CTA Button -->
    <tr>
      <td style="padding: 10px 40px 40px 40px; text-align: center;">
        <a href="${verificationUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
                  color: white; padding: 18px 48px; text-decoration: none; border-radius: 50px; 
                  font-weight: 700; font-size: 16px; letter-spacing: 0.3px;
                  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);">
          ✅ Verify My Email Now
        </a>
        <p style="color: #94a3b8; font-size: 12px; margin: 20px 0 0 0;">
          Button not working? Copy this link:<br>
          <span style="color: #667eea; word-break: break-all; font-size: 11px;">${verificationUrl}</span>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.6;">
          This is an automated email from AttendEase.<br>
          If you didn't expect this, please contact your teacher.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
		};

		// @ts-ignore
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
