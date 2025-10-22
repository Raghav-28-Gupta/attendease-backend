import type {
	Subject,
	Batch,
	Student,
	Teacher,
	SubjectEnrollment,
	TimetableEntry,
	AttendanceSession,
	AttendanceRecord,
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
	subjectEnrollments: SubjectEnrollmentWithDetails[];
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
	teacher: TeacherBasic; //  FIXED: Added teacher info
	_count?: {
		attendanceSessions: number;
		timetableEntries: number;
	};
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
		code: string;
		name: string;
	};
	subjectEnrollment: {
		subject: {
			code: string;
			name: string;
		};
		teacher: {
			//  FIXED: Moved to enrollment level
			firstName: string;
			lastName: string;
			employeeId: string;
		};
	};
}

export interface CreateTimetableEntryDTO {
	batchId: string;
	subjectEnrollmentId: string;
	dayOfWeek: string;
	startTime: string;
	endTime: string;
	classRoom?: string;
	type?: string;
	professor?: string;
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
export interface CreateAttendanceSessionDTO {
	subjectEnrollmentId: string;
	date: Date;
	startTime: string;
	endTime: string;
	type?: SessionType;
}

export interface AttendanceSessionWithDetails extends AttendanceSession {
	subjectEnrollment: {
		subject: {
			code: string;
			name: string;
		};
		batch: {
			code: string;
			name: string;
		};
		teacher: {
			firstName: string;
			lastName: string;
		};
	};
	_count: {
		records: number;
	};
}

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

export interface AttendanceStatsDTO {
	totalSessions: number;
	attended: number;
	percentage: number;
	byStatus: {
		present: number;
		absent: number;
		late: number;
		excused: number;
	};
}

// DASHBOARD TYPES
export interface TeacherDashboardData {
	enrollments: {
		//  FIXED: Changed from subjects to enrollments
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
		};
	}[];
	stats: {
		totalEnrollments: number; //  FIXED: Changed from totalSubjects
		totalBatchesTeaching: number;
		totalStudents: number;
		totalSessions: number;
	};
	recentSessions: AttendanceSessionWithDetails[];
}

export interface StudentDashboardData {
	batch: {
		id: string;
		code: string;
		name: string;
		year: string;
	} | null; //  FIXED: Made nullable
	subjects: {
		code: string;
		name: string;
		teacherName: string;
		attendance: AttendanceStatsDTO;
	}[];
	todayClasses: TimetableEntryWithDetails[];
	recentAttendance: {
		date: Date;
		subject: string;
		status: AttendanceStatus;
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
