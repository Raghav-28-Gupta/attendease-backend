import { z } from "zod";

// Auth validators
export const signupSchema = z
	.object({
		body: z.object({
			email: z.string().email("Invalid email format"),
			password: z
				.string()
				.min(8, "Password must be at least 8 characters")
				.regex(/[A-Z]/, "Password must contain uppercase letter")
				.regex(/[a-z]/, "Password must contain lowercase letter")
				.regex(/[0-9]/, "Password must contain number")
				.regex(
					/[^A-Za-z0-9]/,
					"Password must contain special character"
				),
			role: z.enum(["STUDENT", "TEACHER"], {
				message: "Role must be STUDENT or TEACHER",
			}),
		}),
		firstName: z.string().min(1, "First name is required"),
		lastName: z.string().min(1, "Last name is required"),
		studentId: z.string().optional(),
		employeeId: z.string().optional(),
		department: z.string().optional(),
	})
	.refine(
		(data) => {
			if (data.body.role === "STUDENT") return !!data.studentId;
			if (data.body.role === "TEACHER") return !!data.employeeId;
			return true;
		},
		{
			message:
				"Student ID required for students, Employee ID required for teachers",
			path: ["studentId", "employeeId"],
		}
	);

export const loginSchema = z.object({
	body: z.object({
		email: z.string().email("Invalid email format"),
		password: z.string().min(1, "Password is required"),
	}),
});

export const verifyEmailSchema = z.object({
	query: z.object({
		token: z.string().min(1, "Verification token is required"),
	}),
});


// SUBJECT VALIDATORS
export const createSubjectSchema = z.object({
	body: z.object({
		name: z.string().min(1, "Subject name is required").max(100),
		code: z
			.string()
			.min(1, "Subject code is required")
			.max(20)
			.regex(/^[A-Z0-9]+$/, "Code must be uppercase alphanumeric"),
		semester: z.string().min(1, "Semester is required"),
		department: z.string().min(1, "Department is required"),
		batches: z
			.array(
				z.object({
					name: z.string().min(1, "Batch name is required"),
					capacity: z.number().int().positive().optional(),
					room: z.string().optional(),
				})
			)
			.min(1, "At least one batch is required"),
	}),
});

export const updateSubjectSchema = z.object({
	params: z.object({
		subjectId: z.string().uuid("Invalid subject ID"),
	}),
	body: z.object({
		name: z.string().min(1).max(100).optional(),
		semester: z.string().min(1).optional(),
		department: z.string().min(1).optional(),
	}),
});

export const subjectIdSchema = z.object({
	params: z.object({
		subjectId: z.string().uuid("Invalid subject ID"),
	}),
});

// BATCH VALIDATORS
export const createBatchSchema = z.object({
	body: z.object({
		subjectId: z.string().uuid("Invalid subject ID"),
		name: z.string().min(1, "Batch name is required").max(50),
		capacity: z.number().int().positive().optional(),
		room: z.string().max(50).optional(),
	}),
});

export const updateBatchSchema = z.object({
	params: z.object({
		batchId: z.string().uuid("Invalid batch ID"),
	}),
	body: z.object({
		name: z.string().min(1).max(50).optional(),
		capacity: z.number().int().positive().optional(),
		room: z.string().max(50).optional(),
	}),
});

export const batchIdSchema = z.object({
	params: z.object({
		batchId: z.string().uuid("Invalid batch ID"),
	}),
});

// STUDENT IMPORT VALIDATORS
export const importStudentsSchema = z.object({
	params: z.object({
		batchId: z.string().uuid("Invalid batch ID"),
	}),
});

// CSV row validation (used in service)
export const csvStudentSchema = z.object({
	student_id: z.string().min(1, "Student ID is required"),
	first_name: z.string().min(1, "First name is required"),
	last_name: z.string().min(1, "Last name is required"),
	email: z.string().email("Invalid email format"),
	phone: z.string().optional(),
});

// TIMETABLE VALIDATORS
const DAYS_OF_WEEK = [
	"MONDAY",
	"TUESDAY",
	"WEDNESDAY",
	"THURSDAY",
	"FRIDAY",
	"SATURDAY",
	"SUNDAY",
] as const;

const TIME_REGEX = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;

export const createTimetableEntrySchema = z.object({
	body: z
		.object({
			batchId: z.string().uuid("Invalid batch ID"),
			dayOfWeek: z.enum(DAYS_OF_WEEK, {
				message: "Invalid day of week",
			}),
			startTime: z
				.string()
				.regex(TIME_REGEX, "Time must be in HH:MM:SS format"),
			endTime: z
				.string()
				.regex(TIME_REGEX, "Time must be in HH:MM:SS format"),
			room: z.string().max(50).optional(),
			professor: z.string().max(100).optional(),
		})
		.refine(
			(data) => {
				const start = new Date(`2000-01-01T${data.startTime}`);
				const end = new Date(`2000-01-01T${data.endTime}`);
				return end > start;
			},
			{
				message: "End time must be after start time",
				path: ["endTime"],
			}
		),
});

export const bulkCreateTimetableSchema = z.object({
	params: z.object({
		batchId: z.string().uuid("Invalid batch ID"),
	}),
	body: z.object({
		entries: z
			.array(
				z.object({
					dayOfWeek: z.enum(DAYS_OF_WEEK),
					startTime: z.string().regex(TIME_REGEX),
					endTime: z.string().regex(TIME_REGEX),
					room: z.string().optional(),
					professor: z.string().optional(),
				})
			)
			.min(1, "At least one timetable entry is required"),
	}),
});

export const timetableIdSchema = z.object({
	params: z.object({
		entryId: z.string().uuid("Invalid timetable entry ID"),
	}),
});
