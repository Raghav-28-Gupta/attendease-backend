import prisma from "@config/database";
import { ApiError } from "@utils/ApiError";
import logger from "@utils/logger";
import type {
	CreateSubjectDTO,
	SubjectWithEnrollments,
} from "@local-types/models.types";

export class SubjectService {
	/**
	 * Create subject (independent entity - no teacher ownership)
	 */
	static async createSubject(
		data: CreateSubjectDTO
	): Promise<SubjectWithEnrollments> {
		// Check if subject code exists
		const existing = await prisma.subject.findUnique({
			where: { code: data.code },
		});

		if (existing) {
			throw ApiError.badRequest(`Subject code ${data.code} already exists`);
		}

		const subject = await prisma.subject.create({
			data: {
				code: data.code,
				name: data.name,
				semester: data.semester,
				department: data.department,
				credits: data.credits,
				// No teacherId - subjects are independent
			},
			include: {
				subjectEnrollments: {
					include: {
						batch: {
							select: {
								id: true,
								code: true,
								name: true,
								department: true,
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
						_count: {
							select: {
								attendanceSessions: true,
								timetableEntries: true,
							},
						},
					},
				},
			},
		});

		logger.info(`Subject created: ${data.code}`);

		return subject;
	}

	/**
	 * Get all subjects (optionally filter by department)
	 */
	static async getAllSubjects(department?: string) {
		const subjects = await prisma.subject.findMany({
			where: department ? { department } : undefined,
			include: {
				subjectEnrollments: {
					include: {
						batch: {
							select: {
								code: true,
								name: true,
							},
						},
						teacher: {
							select: {
								firstName: true,
								lastName: true,
								employeeId: true,
							},
						},
					},
				},
				_count: {
					select: {
						subjectEnrollments: true,
					},
				},
			},
			orderBy: { code: "asc" },
		});

		return subjects;
	}

	/**
	 * Get subjects taught by a specific teacher
	 */
	static async getTeacherSubjects(teacherId: string) {
		// Find teacher by userId
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherId },
			include: {
				subjectEnrollments: {
					include: {
						subject: true,
						batch: {
							select: {
								id: true,
								code: true,
								name: true,
							},
						},
						_count: {
							select: {
								attendanceSessions: true,
								timetableEntries: true,
							},
						},
					},
				},
			},
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		// Group enrollments by subject
		const subjectMap = new Map<string, any>();

		teacher.subjectEnrollments.forEach((enrollment) => {
			const subjectId = enrollment.subject.id;

			if (!subjectMap.has(subjectId)) {
				subjectMap.set(subjectId, {
					...enrollment.subject,
					enrollments: [],
				});
			}

			subjectMap.get(subjectId).enrollments.push({
				id: enrollment.id,
				batchCode: enrollment.batch.code,
				batchName: enrollment.batch.name,
				sessionsCount: enrollment._count.attendanceSessions,
				timetableCount: enrollment._count.timetableEntries,
			});
		});

		return Array.from(subjectMap.values());
	}

	/**
	 * Get subject by ID with all enrollments
	 */
	static async getSubjectById(
		subjectId: string
	): Promise<SubjectWithEnrollments> {
		const subject = await prisma.subject.findUnique({
			where: { id: subjectId },
			include: {
				subjectEnrollments: {
					include: {
						batch: {
							select: {
								id: true,
								code: true,
								name: true,
								year: true,
								department: true,
								capacity: true,
							},
						},
						teacher: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								employeeId: true,
								department: true,
							},
						},
						_count: {
							select: {
								attendanceSessions: true,
								timetableEntries: true,
							},
						},
					},
				},
			},
		});

		if (!subject) {
			throw ApiError.notFound("Subject not found");
		}

		return subject;
	}

	/**
	 * Update subject
	 */
	static async updateSubject(
		subjectId: string,
		data: Partial<CreateSubjectDTO>
	) {
		const subject = await prisma.subject.findUnique({
			where: { id: subjectId },
		});

		if (!subject) {
			throw ApiError.notFound("Subject not found");
		}

		// If code is changing, check for duplicates
		if (data.code && data.code !== subject.code) {
			const existing = await prisma.subject.findUnique({
				where: { code: data.code },
			});

			if (existing) {
				throw ApiError.badRequest(
					`Subject code ${data.code} already exists`
				);
			}
		}

		const updated = await prisma.subject.update({
			where: { id: subjectId },
			data,
			include: {
				subjectEnrollments: {
					include: {
						batch: true,
						teacher: true,
					},
				},
			},
		});

		logger.info(`Subject updated: ${subjectId}`);

		return updated;
	}

	/**
	 * Delete subject
	 */
	static async deleteSubject(subjectId: string) {
		const subject = await prisma.subject.findUnique({
			where: { id: subjectId },
			include: {
				subjectEnrollments: true,
			},
		});

		if (!subject) {
			throw ApiError.notFound("Subject not found");
		}

		// Check if subject has enrollments
		if (subject.subjectEnrollments.length > 0) {
			throw ApiError.badRequest(
				`Cannot delete subject with ${subject.subjectEnrollments.length} batch enrollments. Remove enrollments first.`
			);
		}

		await prisma.subject.delete({
			where: { id: subjectId },
		});

		logger.info(`Subject deleted: ${subjectId}`);

		return { message: "Subject deleted successfully" };
	}

	/**
	 * Get subject statistics
	 */
	static async getSubjectStats(subjectId: string) {
		const subject = await this.getSubjectById(subjectId);

		const stats = {
			totalEnrollments: subject.subjectEnrollments.length,
			totalStudents: 0,
			totalSessions: 0,
			averageAttendance: 0,
			enrollments: [] as any[],
		};

		let totalPresent = 0;
		let totalPossible = 0;

		// Calculate stats for each enrollment
		for (const enrollment of subject.subjectEnrollments) {
			const studentCount = await prisma.student.count({
				where: { batchId: enrollment.batch.id },
			});

			stats.totalStudents += studentCount;
			stats.totalSessions += enrollment._count?.attendanceSessions || 0;

			const sessions = await prisma.attendanceSession.findMany({
				where: { subjectEnrollmentId: enrollment.id },
				include: {
					records: {
						select: {
							status: true,
						},
					},
				},
			});

			let enrollmentPresent = 0;
			sessions.forEach((session) => {
				const presentCount = session.records.filter(
					(r) =>
						r.status === "PRESENT" ||
						r.status === "LATE" ||
						r.status === "EXCUSED"
				).length;
				enrollmentPresent += presentCount;
			});

			const enrollmentPossible = sessions.length * studentCount;
			totalPresent += enrollmentPresent;
			totalPossible += enrollmentPossible;

			stats.enrollments.push({
				batchCode: enrollment.batch.code,
				batchName: enrollment.batch.name,
				teacher: `${enrollment.teacher.firstName} ${enrollment.teacher.lastName}`,
				students: studentCount,
				sessions: enrollment._count?.attendanceSessions || 0,
				capacity: enrollment.batch.capacity,
				utilization: enrollment.batch.capacity
					? ((studentCount / enrollment.batch.capacity) * 100).toFixed(1)
					: null,
			});
		}

		stats.averageAttendance =
			totalPossible > 0
				? Math.round((totalPresent / totalPossible) * 100 * 100) / 100 // Round to 2 decimals
				: 0;

		return stats;
	}

	/**
	 * Search subjects by code or name
	 */
	static async searchSubjects(query: string) {
		const subjects = await prisma.subject.findMany({
			where: {
				OR: [
					{ code: { contains: query, mode: "insensitive" } },
					{ name: { contains: query, mode: "insensitive" } },
				],
			},
			include: {
				_count: {
					select: {
						subjectEnrollments: true,
					},
				},
			},
			take: 10,
		});

		return subjects;
	}
}
