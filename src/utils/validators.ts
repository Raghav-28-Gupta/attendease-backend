import { z } from "zod";

// Auth validators
export const signupSchema = z.object({
	body: z
		.object({
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
		)

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
