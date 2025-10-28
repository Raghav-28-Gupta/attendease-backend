import type {
	Subject,
	Batch,
	Student,
	Teacher,
	SubjectEnrollment,
	TimetableEntry,
	AttendanceSession,
	AttendanceRecord,
	AttendanceEdit,
	UserRole,
	AttendanceStatus,
	SessionType,
	EnrollmentStatus,
} from "@prisma/client";

// BATCH TYPES
export interface BatchBasic {
	id: string;
	code: string;
	name: string;
	year: string;
	department: string;
	capacity?: number | null;
	classRoom?: string | null;
}

export interface BatchWithStudents extends Batch {
	students: StudentBasic[];
	subjectEnrollments?: SubjectEnrollmentWithDetails[]; //  FIXED: Added optional enrollments
	_count: {
		students: number;
		subjectEnrollments: number;
	};
}

export interface CreateBatchDTO {
	code: string;
	name: string;
	year: string;
	department: string;
	capacity?: number;
	classRoom?: string;
}

export interface UpdateBatchDTO {
	name?: string;
	capacity?: number;
	classRoom?: string;
}

// SUBJECT TYPES
export interface SubjectBasic {
	id: string;
	code: string;
	name: string;
	semester: string;
	department: string;
	credits?: number | null;
}

export interface SubjectWithEnrollments extends Subject {
	//  FIXED: Removed direct teacher relation
	subjectEnrollments: SubjectEnrollmentBasic[];
	_count?: {
		subjectEnrollments: number;
	};
}

export interface CreateSubjectDTO {
	code: string;
	name: string;
	semester: string;
	department: string;
	credits?: number;
}

export interface UpdateSubjectDTO {
	name?: string;
	semester?: string;
	credits?: number;
}

// TEACHER TYPES (NEW)
export interface TeacherBasic {
	id: string;
	employeeId: string;
	firstName: string;
	lastName: string;
	department?: string | null;
	phone?: string | null;
}

export interface TeacherWithEnrollments extends Teacher {
	subjectEnrollments: {
		id: string;
		subject: {
			code: string;
			name: string;
		};
		batch: {
			code: string;
			name: string;
		};
		_count?: {
			attendanceSessions: number;
		};
	}[];
}

// SUBJECT ENROLLMENT TYPES
export interface SubjectEnrollmentWithDetails extends SubjectEnrollment {
	batch: BatchBasic;
	subject: SubjectBasic;
	teacher: {
		// Change from 'Teacher' to 'teacher' (lowercase)
		id: string;
		employeeId: string;
		firstName: string;
		lastName: string;
		department?: string | null;
	};
	_count?: {
		attendanceSessions: number;
		timetableEntries: number;
	};
}

// For queries FROM Subject (doesn't need subject reference in enrollments)
export interface SubjectEnrollmentBasic extends SubjectEnrollment {
	batch: {
		id: string;
		code: string;
		name: string;
		year?: string;
		department: string;
		capacity?: number | null;
		classRoom?: string | null;
	};
	teacher: {
		id: string;
		employeeId: string;
		firstName: string;
		lastName: string;
		department?: string | null;
	};
	_count?: {
		attendanceSessions: number;
		timetableEntries: number;
	};
}

export interface EnrollBatchesDTO {
	subjectId: string;
	batchIds: string[];
	semester: string;
}

export interface SubjectEnrollmentWithBatch extends SubjectEnrollment {
	batch: BatchBasic;
	subject: {
		id: string;
		code: string;
		name: string;
	};
	teacher: {
		//  FIXED: Added teacher info
		id: string;
		firstName: string;
		lastName: string;
		employeeId: string;
	};
	_count?: {
		// Add this property
		attendanceSessions: number;
		timetableEntries?: number;
	};
}

export interface CreateSubjectEnrollmentDTO {
	subjectId: string;
	batchId: string;
	teacherId: string; //  FIXED: Added required teacherId
	semester?: string;
	room?: string; //  FIXED: Added optional room
}

export interface UpdateSubjectEnrollmentDTO {
	teacherId?: string;
	semester?: string;
	room?: string;
	status?: EnrollmentStatus;
}

export interface EnrollBatchWithTeacherDTO {
	batchId: string;
	teacherId: string;
}

export interface BulkEnrollSubjectDTO {
	subjectId: string;
	enrollments: EnrollBatchWithTeacherDTO[]; //  FIXED: More flexible structure
}

// STUDENT TYPES
export interface StudentBasic {
	id: string;
	studentId: string;
	firstName: string;
	lastName: string;
	phone?: string | null;
	batchId?: string | null;
}

export interface StudentWithBatch extends Student {
	batch: {
		//  FIXED: Made nullable
		id: string;
		code: string;
		name: string;
		department: string;
	} | null;
	user?: {
		email: string;
		emailVerified: boolean;
	};
}

export interface UpdateStudentProfileDTO {
	firstName?: string;
	lastName?: string;
	phone?: string;
}

export interface StudentWithAttendance extends StudentBasic {
	attendanceRecords: {
		status: AttendanceStatus;
		session: {
			date: Date;
			subjectEnrollment: {
				subject: {
					code: string;
					name: string;
				};
			};
		};
	}[];
}

export interface ImportStudentDTO {
	studentId: string;
	firstName: string;
	lastName: string;
	email: string;
	phone?: string;
}

export interface BulkImportResult {
	successful: number;
	failed: number;
	errors: {
		row: number;
		studentId: string;
		error: string;
	}[];
}

// TIMETABLE TYPES
export interface TimetableEntryWithDetails extends TimetableEntry {
	batch: {
		id: string;
		code: string;
		name: string;
		department: string;
		year: string;
	};
	subjectEnrollment: {
		id: string;
		subject: {
			id: string;
			code: string;
			name: string;
			semester: string;
		};
		teacher: {
			id: string;
			employeeId: string;
			firstName: string;
			lastName: string;
		};
		room: string | null;
	};
}
export interface CreateTimetableEntryDTO {
	subjectEnrollmentId: string;
	dayOfWeek: string;
	startTime: string;
	endTime: string;
	classRoom?: string;
}

export interface UpdateTimetableEntryDTO {
	dayOfWeek?: string;
	startTime?: string;
	endTime?: string;
	classRoom?: string;
	type?: string;
	professor?: string;
}

export interface BatchTimetableResponse {
	//  NEW: Added response type
	batch: {
		id: string;
		code: string;
		name: string;
	};
	timetable: {
		[day: string]: TimetableEntryWithDetails[];
	};
}

export interface BatchTimetableDTO {
	subjectEnrollmentId: string;
	dayOfWeek: string;
	startTime: string;
	endTime: string;
	classRoom?: string;
	type?: string;
}

// ATTENDANCE TYPES
export interface AttendanceRecordWithStudent extends AttendanceRecord {
	student: StudentBasic;
}

export interface MarkAttendanceDTO {
	sessionId: string;
	records: {
		studentId: string;
		status: AttendanceStatus;
	}[];
}

// ATTENDANCE SESSION TYPES
export interface AttendanceSessionWithDetails extends AttendanceSession {
	subjectEnrollment: {
		id: string;
		subject: {
			id: string;
			code: string;
			name: string;
		};
		batch: {
			id: string;
			code: string;
			name: string;
		};
		teacher: {
			id: string;
			firstName: string;
			lastName: string;
			employeeId: string;
		};
	};
	_count: {
		records: number;
	};
}

export interface CreateAttendanceSessionDTO {
	subjectEnrollmentId: string;
	date: Date | string;
	startTime: string; // "HH:MM:SS"
	endTime: string; // "HH:MM:SS"
	type?: SessionType;
}

export interface SessionWithRecords extends AttendanceSession {
	subjectEnrollment: {
		subject: {
			code: string;
			name: string;
		};
		batch: {
			code: string;
			name: string;
		};
	};
	records: AttendanceRecordWithStudent[];
}

// ATTENDANCE RECORD TYPES
export interface AttendanceRecordWithSession extends AttendanceRecord {
	session: {
		id: string;
		date: Date;
		startTime: string;
		endTime: string;
		subjectEnrollment: {
			subject: {
				code: string;
				name: string;
			};
		};
	};
}

export interface UpdateAttendanceDTO {
	status: AttendanceStatus;
	reason?: string;
}

// ATTENDANCE STATISTICS TYPES

export interface AttendanceStatsDTO {
	totalSessions: number;
	present: number;
	absent: number;
	late: number;
	excused: number;
	percentage: number;
	status: "GOOD" | "WARNING" | "CRITICAL"; // >= 75% = GOOD, 65-74% = WARNING, < 65% = CRITICAL
}

export interface StudentAttendanceOverview {
	student: {
		id: string;
		studentId: string;
		firstName: string;
		lastName: string;
	};
	stats: AttendanceStatsDTO;
	recentRecords: AttendanceRecordWithSession[];
}

export interface SubjectAttendanceSummary {
	subjectEnrollment: {
		id: string;
		subject: {
			code: string;
			name: string;
		};
		batch: {
			code: string;
			name: string;
		};
	};
	stats: {
		totalSessions: number;
		totalStudents: number;
		averageAttendance: number;
		lastSession: Date | null;
	};
}

// DASHBOARD TYPES (UPDATED)
export interface TeacherDashboardData {
	enrollments: {
		id: string;
		subject: {
			code: string;
			name: string;
			semester: string;
		};
		batch: {
			code: string;
			name: string;
			studentCount: number;
		};
		stats: {
			sessionsHeld: number;
			averageAttendance: number;
			lastSession: Date | null;
		};
	}[];
	stats: {
		totalEnrollments: number;
		totalBatchesTeaching: number;
		totalStudents: number;
		totalSessions: number;
		averageAttendance: number;
	};
	recentSessions: AttendanceSessionWithDetails[];
	lowAttendanceStudents: {
		studentId: string;
		name: string;
		batchCode: string;
		subjectCode: string;
		percentage: number;
	}[];
}

export interface StudentDashboardData {
	student: {
		id: string;
		studentId: string;
		firstName: string;
		lastName: string;
	};
	batch: {
		id: string;
		code: string;
		name: string;
		year: string;
	} | null;
	subjects: {
		enrollmentId: string;
		code: string;
		name: string;
		teacherName: string;
		attendance: AttendanceStatsDTO;
	}[];
	todayClasses: TimetableEntryWithDetails[];
	recentAttendance: AttendanceRecordWithSession[];
	alerts: {
		type: "LOW_ATTENDANCE" | "ABSENT_TODAY" | "NEARING_THRESHOLD";
		subject: string;
		message: string;
		percentage?: number;
	}[];
}


// API RESPONSE TYPES
export interface PaginatedResponse<T> {
	data: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	message?: string;
	error?: string;
}