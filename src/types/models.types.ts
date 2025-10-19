import type {
	Subject,
	Batch,
	Student,
	TimetableEntry,
	AttendanceSession,
	UserRole,
	AttendanceStatus,
	SessionType,
} from "@prisma/client";


// SUBJECT TYPES
export interface SubjectWithRelations extends Subject {
	teacher: {
		id: string;
		firstName: string;
		lastName: string;
		employeeId: string;
	};
	batches: BatchWithCount[];
}

export interface CreateSubjectDTO {
	name: string;
	code: string;
	semester: string;
	department: string;
	batches: {
		name: string;
		capacity?: number;
		room?: string;
	}[];
}

export interface UpdateSubjectDTO {
	name?: string;
	semester?: string;
	department?: string;
}

// BATCH TYPES
export interface BatchWithCount extends Batch {
	_count: {
		students: number;
		timetableEntries: number;
		attendanceSessions: number;
	};
}

export interface BatchWithRelations extends Batch {
	subject: Subject;
	students: StudentBasic[];
	timetableEntries: TimetableEntry[];
}

export interface CreateBatchDTO {
	subjectId: string;
	name: string;
	capacity?: number;
	room?: string;
}

export interface UpdateBatchDTO {
	name?: string;
	capacity?: number;
	room?: string;
}

// STUDENT TYPES
export interface StudentBasic {
	id: string;
	studentId: string;
	firstName: string;
	lastName: string;
	phone?: string | null;
}

export interface StudentWithBatch extends Student {
	batch: {
		id: string;
		name: string;
		code: string;
		subject: {
			id: string;
			name: string;
			code: string;
		};
	};
}

export interface ImportStudentDTO {
	studentId: string;
	firstName: string;
	lastName: string;
	email: string;
	phone?: string;
}

// TIMETABLE TYPES
export interface TimetableEntryWithBatch extends TimetableEntry {
	batch: {
		id: string;
		name: string;
		subject: {
			name: string;
			code: string;
		};
	};
}

export interface CreateTimetableEntryDTO {
	batchId: string;
	dayOfWeek: string;
	startTime: string;
	endTime: string;
	room?: string;
	professor?: string;
}

export interface BatchTimetableDTO {
	dayOfWeek: string;
	startTime: string;
	endTime: string;
	room?: string;
	professor?: string;
}

// ATTENDANCE TYPES
export interface CreateAttendanceSessionDTO {
	subjectId: string;
	batchId: string;
	date: Date;
	startTime: string;
	endTime: string;
	type?: SessionType;
}

export interface AttendanceSessionWithDetails extends AttendanceSession {
	subject: {
		name: string;
		code: string;
	};
	batch: {
		name: string;
		code: string;
	};
	teacher: {
		firstName: string;
		lastName: string;
	};
	_count: {
		records: number;
	};
}

// DASHBOARD TYPES
export interface TeacherDashboardData {
	subjects: {
		id: string;
		name: string;
		code: string;
		semester: string;
		batches: {
			id: string;
			name: string;
			code: string;
			studentCount: number;
			sessionsHeld: number;
		}[];
	}[];
	stats: {
		totalSubjects: number;
		totalBatches: number;
		totalStudents: number;
		totalSessions: number;
	};
}

export interface StudentDashboardData {
	batch: {
		id: string;
		name: string;
		code: string;
		subject: {
			name: string;
			code: string;
		};
	};
	timetable: TimetableEntryWithBatch[];
	attendance: {
		totalSessions: number;
		attended: number;
		percentage: number;
	};
}
