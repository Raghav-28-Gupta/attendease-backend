import { z } from "zod";

const TIME_REGEX = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;

// AUTH VALIDATORS
export const signupSchema = z.object({
	body: z.object({
		email: z.string().email("Invalid email format"),
		password: z
			.string()
			.min(8, "Password must be at least 8 characters")
			.regex(/[A-Z]/, "Password must contain uppercase letter")
			.regex(/[a-z]/, "Password must contain lowercase letter")
			.regex(/[0-9]/, "Password must contain number")
			.regex(/[^A-Za-z0-9]/, "Password must contain special character"),
		role: z.literal("TEACHER", {
			message:
				"Only teachers can signup directly. Students are added by teachers.",
		}),
		firstName: z.string().min(1, "First name is required"),
		lastName: z.string().min(1, "Last name is required"),
		employeeId: z.string().min(1, "Employee ID is required"),
		department: z.string().optional(),
		phone: z.string().optional(),
	}),
});

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

export const refreshTokenSchema = z.object({
	body: z.object({
		refreshToken: z.string().min(1, "Refresh token is required"),
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
		credits: z.number().positive().optional(), // ADDED
		// REMOVED: batches array - now enrolled separately
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
		credits: z.number().positive().optional(),
	}),
});

export const subjectIdSchema = z.object({
	params: z.object({
		subjectId: z.string().uuid("Invalid subject ID"),
	}),
});

// BATCH VALIDATORS
export const createBatchSchema = z.object({
	// REPLACED - No more subjectId
	body: z.object({
		code: z
			.string()
			.min(1, "Batch code is required")
			.max(20)
			.regex(/^[A-Z0-9]+$/i, "Code must be alphanumeric"),
		name: z.string().min(1, "Batch name is required").max(100),
		year: z.string().min(1, "Year is required"),
		department: z.string().min(1, "Department is required"),
		capacity: z.number().int().positive().optional(),
		classRoom: z.string().max(50).optional(),
	}),
});

export const updateBatchSchema = z.object({
	params: z.object({
		batchId: z.string().uuid("Invalid batch ID"),
	}),
	body: z.object({
		name: z.string().min(1).max(100).optional(),
		capacity: z.number().int().positive().optional(),
		classRoom: z.string().max(50).optional(),
	}),
});

export const batchIdSchema = z.object({
	params: z.object({
		batchId: z.string().uuid("Invalid batch ID"),
	}),
});

// SUBJECT ENROLLMENT VALIDATORS (NEW)
export const createSubjectEnrollmentSchema = z.object({
	// NEW - Single enrollment
	body: z.object({
		subjectId: z.string().uuid("Invalid subject ID"),
		batchId: z.string().uuid("Invalid batch ID"),
		teacherId: z.string().uuid("Invalid teacher ID"), // Required
		semester: z.string().optional(),
		room: z.string().max(50).optional(),
	}),
});

export const enrollBatchesSchema = z.object({
	// FIXED - Added teacherId
	body: z.object({
		subjectId: z.string().uuid("Invalid subject ID"),
		batchIds: z
			.array(z.string().uuid("Invalid batch ID"))
			.min(1, "At least one batch required"),
		// teacherId: z.string().uuid("Invalid teacher ID"), 
		semester: z.string().optional(),
		room: z.string().optional(), // ADDED
	}),
});

export const updateSubjectEnrollmentSchema = z.object({
	// NEW
	params: z.object({
		enrollmentId: z.string().uuid("Invalid enrollment ID"),
	}),
	body: z.object({
		teacherId: z.string().uuid("Invalid teacher ID").optional(),
		semester: z.string().optional(),
		room: z.string().max(50).optional(),
		status: z.enum(["ACTIVE", "DROPPED", "COMPLETED"]).optional(),
	}),
});

export const subjectEnrollmentIdSchema = z.object({
	params: z.object({
		enrollmentId: z.string().uuid("Invalid enrollment ID"),
	}),
});

export const subjectBatchesSchema = z.object({
	// NEW
	params: z.object({
		subjectId: z.string().uuid("Invalid subject ID"),
	}),
	query: z
		.object({
			includeStats: z.enum(["true", "false"]).optional(),
		})
		.optional(),
});

export const batchSubjectsSchema = z.object({
	// NEW
	params: z.object({
		batchId: z.string().uuid("Invalid batch ID"),
	}),
	query: z
		.object({
			includeTeachers: z.enum(["true", "false"]).optional(),
		})
		.optional(),
});

// STUDENT IMPORT VALIDATORS
export const importStudentsSchema = z.object({
	params: z.object({
		batchId: z.string().uuid("Invalid batch ID"),
	}),
});

export const addStudentManuallySchema = z.object({
	// NEW
	params: z.object({
		batchId: z.string().uuid("Invalid batch ID"),
	}),
	body: z.object({
		studentId: z.string().min(1, "Student ID is required"),
		firstName: z.string().min(1, "First name is required"),
		lastName: z.string().min(1, "Last name is required"),
		email: z.string().email("Invalid email format"),
		phone: z.string().optional(),
		password: z.string().min(8, "Password must be at least 8 characters"),
	}),
});

export const removeStudentSchema = z.object({
	// NEW
	params: z.object({
		batchId: z.string().uuid("Invalid batch ID"),
		studentId: z.string().uuid("Invalid student ID"),
	}),
});

// CSV row validation (used in service)
export const csvStudentSchema = z.object({
	studentId: z.string().min(1, "Student ID is required"),
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
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



export const createTimetableEntrySchema = z.object({
	// UPDATED - Added subjectEnrollmentId
	body: z
		.object({
			batchId: z.string().uuid("Invalid batch ID"),
			subjectEnrollmentId: z
				.string()
				.uuid("Invalid subject enrollment ID"), // ADDED
			dayOfWeek: z.enum(DAYS_OF_WEEK, {
				message: "Invalid day of week",
			}),
			startTime: z
				.string()
				.regex(TIME_REGEX, "Time must be in HH:MM:SS format"),
			endTime: z
				.string()
				.regex(TIME_REGEX, "Time must be in HH:MM:SS format"),
			classRoom: z.string().max(50).optional(), // Changed from 'room'
			type: z.string().max(50).optional(), // ADDED
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

export const updateTimetableEntrySchema = z.object({
	// NEW
	params: z.object({
		entryId: z.string().uuid("Invalid timetable entry ID"),
	}),
	body: z.object({
		dayOfWeek: z.enum(DAYS_OF_WEEK).optional(),
		startTime: z.string().regex(TIME_REGEX).optional(),
		endTime: z.string().regex(TIME_REGEX).optional(),
		classRoom: z.string().max(50).optional(),
		type: z.string().max(50).optional(),
		professor: z.string().max(100).optional(),
	}),
});

export const bulkCreateTimetableSchema = z.object({
	// UPDATED
	params: z.object({
		batchId: z.string().uuid("Invalid batch ID"),
	}),
	body: z.object({
		entries: z
			.array(
				z.object({
					subjectEnrollmentId: z
						.string()
						.uuid("Invalid subject enrollment ID"), // ADDED
					dayOfWeek: z.enum(DAYS_OF_WEEK),
					startTime: z.string().regex(TIME_REGEX),
					endTime: z.string().regex(TIME_REGEX),
					classRoom: z.string().optional(),
					type: z.string().optional(),
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

// ATTENDANCE VALIDATORS
export const createAttendanceSessionSchema = z.object({
	body: z
		.object({
			subjectEnrollmentId: z.string().uuid("Invalid enrollment ID"),
			date: z.string().datetime().or(z.date()),
			startTime: z
				.string()
				.regex(TIME_REGEX, "Time must be in HH:MM:SS format"),
			endTime: z
				.string()
				.regex(TIME_REGEX, "Time must be in HH:MM:SS format"),
			type: z.enum(["REGULAR", "MAKEUP", "EXTRA"]).optional(),
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

export const markAttendanceSchema = z.object({
	body: z.object({
		sessionId: z.string().uuid("Invalid session ID"),
		records: z
			.array(
				z.object({
					studentId: z.string().uuid("Invalid student ID"),
					status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
				})
			)
			.min(1, "At least one attendance record required"),
	}),
});

export const updateAttendanceSchema = z.object({
	params: z.object({
		recordId: z.string().uuid("Invalid record ID"),
	}),
	body: z.object({
		status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
		reason: z
			.string()
			.min(5, "Reason must be at least 5 characters")
			.optional(),
	}),
});

export const attendanceSessionIdSchema = z.object({
	params: z.object({
		sessionId: z.string().uuid("Invalid session ID"),
	}),
});

export const attendanceRecordIdSchema = z.object({
	params: z.object({
		recordId: z.string().uuid("Invalid record ID"),
	}),
});

export const getStudentAttendanceSchema = z.object({
	params: z.object({
		studentId: z.string().uuid("Invalid student ID"),
	}),
	query: z.object({
		subjectEnrollmentId: z
			.string()
			.uuid("Invalid enrollment ID")
			.optional(),
	}),
});

export const getEnrollmentAttendanceSchema = z.object({
	params: z.object({
		enrollmentId: z.string().uuid("Invalid enrollment ID"),
	}),
	query: z.object({
		startDate: z.string().datetime().optional(),
		endDate: z.string().datetime().optional(),
	}),
});
