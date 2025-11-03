import prisma from "@config/database";
import { ApiError } from "@utils/ApiError";
import logger from "@utils/logger";
import type {
	EnrollBatchesDTO,
	SubjectEnrollmentWithBatch,
     UpdateSubjectEnrollmentDTO,
} from "@local-types/models.types";

export class SubjectEnrollmentService {
	/**
	 * Enroll batches to a subject (teacher assigns which batches take their subject)
	 */
	static async enrollBatchesToSubject(
		teacherUserId: string,
		data: EnrollBatchesDTO
	) {
		const { subjectId, batchIds, semester } = data;

		// Verify subject exists
		const subject = await prisma.subject.findUnique({
			where: { id: subjectId },
		});
		if (!subject) throw ApiError.notFound("Subject not found");

		// Resolve teacher (by userId) - teacher assigns themselves to enrollments
		const teacher = await prisma.teacher.findUnique({
			where: { userId: teacherUserId },
		});
		if (!teacher) throw ApiError.forbidden("Teacher profile not found");

		// Verify all batches exist
		const batches = await prisma.batch.findMany({
			where: { id: { in: batchIds } },
		});
		if (batches.length !== batchIds.length) {
			throw ApiError.badRequest("One or more batch IDs are invalid");
		}

		// Upsert enrollments with teacherId on enrollment
		const enrollments = await prisma.$transaction(
			batchIds.map((batchId) =>
				prisma.subjectEnrollment.upsert({
					where: {
						subjectId_batchId: {
							subjectId,
							batchId,
						},
					},
					create: {
						subjectId,
						batchId,
						teacherId: teacher.id,
						semester: semester ?? subject.semester,
						status: "ACTIVE",
					},
					update: {
						status: "ACTIVE",
						teacherId: teacher.id,
						semester: semester ?? subject.semester,
					},
					include: {
						batch: true,
						subject: true,
						teacher: {
							select: {
								id: true,
								userId: true,
								employeeId: true,
								firstName: true,
								lastName: true,
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
				})
			)
		);

		logger.info(
			`Teacher ${teacher.employeeId} enrolled ${batchIds.length} batches to subject ${subject.code}`
		);

		return {
			message: `${batchIds.length} batches enrolled successfully`,
			enrollments,
		};
	}

	/**
	 * Get all enrollments for a subject (which batches are enrolled)
	 * If teacherUserId provided, only return enrollments for that teacher
	 */
	static async getSubjectEnrollments(
		subjectId: string,
		teacherUserId?: string
	) {
		const subject = await prisma.subject.findUnique({
			where: { id: subjectId },
		});
		if (!subject) throw ApiError.notFound("Subject not found");

		const teacher = teacherUserId
			? await prisma.teacher.findUnique({
					where: { userId: teacherUserId },
			  })
			: null;

		if (teacherUserId && !teacher)
			throw ApiError.forbidden("Teacher profile not found");

		const enrollments = await prisma.subjectEnrollment.findMany({
			where: {
				subjectId,
				status: "ACTIVE",
				...(teacher ? { teacherId: teacher.id } : {}),
			},
			include: {
				batch: {
					include: {
						_count: { select: { students: true } },
					},
				},
				teacher: {
					select: {
						id: true,
						userId: true,
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
			orderBy: { batch: { code: "asc" } },
		});

		return enrollments;
	}

	/**
	 * Get enrollment by ID
	 */
	static async getEnrollmentById(
		enrollmentId: string,
		teacherUserId?: string
	): Promise<SubjectEnrollmentWithBatch> {
		const enrollment = await prisma.subjectEnrollment.findUnique({
			where: { id: enrollmentId },
			include: {
				batch: true,
				subject: true,
				teacher: {
					select: {
						id: true,
						userId: true,
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
		});

		if (!enrollment) throw ApiError.notFound("Enrollment not found");

		if (teacherUserId) {
			// verify teacher is the owner of this enrollment (by userId)
			if (
				!enrollment.teacher ||
				enrollment.teacher.userId !== teacherUserId
			) {
				throw ApiError.forbidden(
					"You do not have access to this enrollment"
				);
			}
		}

		return enrollment as SubjectEnrollmentWithBatch;
	}

	/**
	 * Remove batch from subject (unenroll)
	 */
	static async unenrollBatch(enrollmentId: string, teacherUserId: string) {
		const enrollment = await this.getEnrollmentById(
			enrollmentId,
			teacherUserId
		);

		const teacher = await prisma.teacher.findUnique({
            where: { userId: teacherUserId },
		});

		if (!teacher) {
			throw ApiError.notFound("Teacher profile not found");
		}

		if (enrollment.teacherId !== teacher.id) {
			throw ApiError.forbidden(
				"You can only unenroll batches from subjects you teach"
			);
		}

		if (enrollment._count && enrollment._count.attendanceSessions > 0) {
			throw ApiError.badRequest(
				`Cannot unenroll batch with ${enrollment._count.attendanceSessions} attendance sessions. Archive instead?`
			);
		}

		await prisma.subjectEnrollment.delete({ where: { id: enrollmentId } });

		logger.info(
			`Batch ${enrollment.batch.code} unenrolled from subject ${enrollment.subject.code}`
		);

		return {
			message: `Batch ${enrollment.batch.code} unenrolled successfully`,
		};
	}

	/**
	 * Get all subjects a batch is enrolled in
	 */
	static async getBatchSubjects(batchId: string) {
		const batch = await prisma.batch.findUnique({ where: { id: batchId } });
		if (!batch) throw ApiError.notFound("Batch not found");

		const enrollments = await prisma.subjectEnrollment.findMany({
			where: { batchId, status: "ACTIVE" },
			include: {
				subject: {
					include: {
						// subject has no direct teacher relation; teacher info is on enrollment
					},
					select: {
						id: true,
						code: true,
						name: true,
						department: true,
					},
				},
				teacher: {
					select: {
						firstName: true,
						lastName: true,
						employeeId: true,
						userId: true,
					},
				},
				_count: { select: { attendanceSessions: true } },
			},
			orderBy: { subject: { code: "asc" } },
		});

		return enrollments;
	}

	// ...existing code...

	/**
	 * Update enrollment details (teacher, status, semester, etc.)
	 */
	static async updateEnrollment(
		enrollmentId: string,
		teacherUserId: string | undefined,
		data: UpdateSubjectEnrollmentDTO
	): Promise<SubjectEnrollmentWithBatch> {
		// Get enrollment with authorization check
		const enrollment = await this.getEnrollmentById(
			enrollmentId,
			teacherUserId
		);

		// Validate new teacher if changing
		if (data.teacherId) {
			const newTeacher = await prisma.teacher.findUnique({
				where: { id: data.teacherId },
			});

			if (!newTeacher) {
				throw ApiError.notFound("Teacher not found");
			}
		}

		// Update enrollment
		const updated = await prisma.subjectEnrollment.update({
			where: { id: enrollmentId },
			data: {
				teacherId: data.teacherId,
				semester: data.semester,
				status: data.status,
			},
			include: {
				batch: {
					select: {
						id: true,
						code: true,
						name: true,
						department: true,
						year: true,
					},
				},
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
						employeeId: true,
						firstName: true,
						lastName: true,
					},
				},
				_count: {
					select: {
						attendanceSessions: true,
					},
				},
			},
		});

		return updated;
	}

	// ...existing code...
}
