# AttendEase Backend

A comprehensive attendance management system backend built with TypeScript, Express, Prisma, and PostgreSQL. Designed for educational institutions to streamline attendance tracking, student management, and real-time notifications.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Database Schema](#database-schema)
- [Authentication Flow](#authentication-flow)
- [API Endpoints](#api-endpoints)
- [Data Models](#data-models)
- [WebSocket Events](#websocket-events)
- [Notification System](#notification-system)
- [Testing Examples](#testing-examples)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## ✨ Features

### For Teachers
- 📚 **Batch Management**: Create and manage student batches/classes
- 👥 **Student Import**: Bulk import students via CSV with validation
- 📖 **Subject Management**: Create subjects with credit hours
- 🔗 **Subject Enrollment**: Enroll entire batches to subjects
- ✅ **Attendance Sessions**: Create and manage attendance sessions
- 📊 **Dashboard Analytics**: View enrollment statistics and low-attendance alerts
- 📅 **Timetable Management**: Maintain weekly schedules for batches
- 🔔 **Automated Notifications**: Push and email alerts for low attendance

### For Students
- 📱 **Personal Dashboard**: View enrolled subjects and attendance statistics
- 📈 **Attendance Tracking**: Monitor attendance percentage with status indicators (GOOD/WARNING/CRITICAL)
- 🔔 **Real-time Alerts**: Receive instant notifications when attendance is marked
- 📧 **Email Notifications**: Get alerts when attendance falls below thresholds
- 📊 **Subject-wise Stats**: Detailed attendance breakdown per subject

### System Features
- 🔐 **JWT Authentication**: Secure access and refresh token mechanism
- ✉️ **Email Verification**: Account activation via email
- 🔄 **Real-time Updates**: WebSocket integration for live notifications
- 📲 **Push Notifications**: Firebase Cloud Messaging for mobile apps
- 🛡️ **Role-based Access**: Separate permissions for TEACHER and STUDENT roles
- 🚦 **Rate Limiting**: API protection against abuse
- 📝 **Request Validation**: Zod schemas for robust input validation
- 🔍 **Error Logging**: Winston-based logging system

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh) v1.2.18 (fast Node.js alternative)
- **Framework**: Express v5.1.0
- **Language**: TypeScript v5
- **Database**: PostgreSQL (Neon Cloud) with Prisma ORM v6.18.0
- **Authentication**: JWT (jsonwebtoken) + bcrypt
- **Validation**: Zod v4.1.12
- **Real-time**: Socket.IO v4.8.1
- **Notifications**: 
  - Firebase Admin SDK v13.5.0 (FCM)
  - Nodemailer v7.0.9 (Email)
- **Security**: 
  - Helmet v8.1.0
  - express-rate-limit v8.1.0
  - CORS v2.8.5
- **Logging**: Winston v3.18.3

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                        │
│            (Mobile App, Web Frontend, Postman)              │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/WebSocket
┌────────────────────────┼────────────────────────────────────┐
│                     MIDDLEWARE LAYER                        │
│  • authenticate()  • authorize()  • validate()              │
│  • rateLimiter     • errorHandler • CORS                    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│                      ROUTES LAYER                           │
│  auth.routes → batch.routes → attendance.routes             │
│  subject.routes → enrollment.routes → dashboard.routes      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│                   CONTROLLERS LAYER                         │
│  Handle HTTP requests, validate input, format responses     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│                    SERVICES LAYER                           │
│  Business logic, calculations, database operations          │
│  • AttendanceService  • BatchService  • AuthService         │
│  • NotificationService • WebSocketService                   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│                    DATABASE LAYER                           │
│               Prisma ORM ↔ PostgreSQL (Neon)                │
└─────────────────────────────────────────────────────────────┘
```

### Design Pattern: MVC + Service Layer
- **Routes**: Define endpoints and apply middleware
- **Controllers**: Handle HTTP concerns (req/res)
- **Services**: Implement business logic and data access
- **Models**: Prisma schema defines database structure
- **Middleware**: Cross-cutting concerns (auth, validation, errors)

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.2.18 or higher
- PostgreSQL database (e.g., [Neon](https://neon.tech))
- Firebase project (for FCM)
- Gmail account (for email notifications)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd attendease-backend
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment variables**
   
   Create `.env` file in the root directory:
   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=5000
   
   # Database
   DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
   
   # JWT Secrets (use strong random strings)
   ACCESS_TOKEN_SECRET="your-access-token-secret-min-32-chars"
   REFRESH_TOKEN_SECRET="your-refresh-token-secret-min-32-chars"
   ACCESS_TOKEN_EXPIRY="15m"
   REFRESH_TOKEN_EXPIRY="7d"
   
   # Email Configuration (Gmail)
   EMAIL_HOST="smtp.gmail.com"
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER="your-email@gmail.com"
   EMAIL_PASSWORD="your-app-password"  # Generate from Google Account settings
   EMAIL_FROM="AttendEase <your-email@gmail.com>"
   
   # Firebase Admin SDK (for FCM)
   FIREBASE_PROJECT_ID="your-project-id"
   FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourPrivateKeyHere\n-----END PRIVATE KEY-----"
   
   # Frontend URL (for CORS and email links)
   FRONTEND_URL="http://localhost:3000"
   
   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
   RATE_LIMIT_MAX_REQUESTS=100
   ```

   **Important Notes:**
   - **Gmail App Password**: Don't use your regular Gmail password. Generate an app-specific password:
     1. Go to Google Account → Security → 2-Step Verification
     2. Scroll to "App passwords"
     3. Generate password for "Mail" app
   - **Firebase Private Key**: Must be a single-line string with `\n` for newlines
   - **Database URL**: Neon provides this in your project dashboard

4. **Set up the database**
   
   Generate Prisma client:
   ```bash
   bun run prisma:generate
   ```
   
   Run migrations:
   ```bash
   bun run prisma:migrate
   ```
   
   (Optional) Open Prisma Studio to view data:
   ```bash
   bun run prisma:studio
   ```

5. **Run the development server**
   ```bash
   bun run dev
   ```
   
   The server will start on `http://localhost:5000` with hot-reload enabled.

### Available Scripts

```bash
bun run dev              # Start development server with watch mode
bun run start            # Start production server
bun run build            # Build for production

bun run prisma:generate  # Generate Prisma Client
bun run prisma:migrate   # Run database migrations
bun run prisma:studio    # Open Prisma Studio GUI
bun run db:push          # Push schema changes (development only)
bun run db:reset         # Reset database and re-run migrations

bun test                 # Run tests
```

## 🗄️ Database Schema

### Core Entities

```
User (Authentication)
├── Teacher (Profile + Owned Resources)
│   ├── Batches (1:N)
│   ├── Subjects (1:N)
│   └── TimetableEntries (1:N)
└── Student (Profile + Enrollment)
    ├── SubjectEnrollments (N:M via Batch)
    ├── AttendanceRecords (1:N)
    └── FCMTokens (1:N for multi-device)

Batch (Class/Group)
├── Students (1:N)
├── SubjectEnrollments (N:M with Subject)
└── TimetableEntries (1:N)

Subject (Course)
├── SubjectEnrollments (N:M with Batch)

SubjectEnrollment (Batch enrolled in Subject)
└── AttendanceSessions (1:N)

AttendanceSession (Class meeting)
└── AttendanceRecords (1:N per student)
```

### Key Relationships

- **Teacher owns**: Batches, Subjects, Timetable entries
- **Batch enrolls in**: Multiple Subjects (many-to-many)
- **Student belongs to**: One Batch, multiple SubjectEnrollments
- **AttendanceSession**: Linked to SubjectEnrollment (Batch + Subject)
- **AttendanceRecord**: Links Student + AttendanceSession (unique constraint prevents duplicates)

### Important Constraints

- `User.email`: Unique
- `Student.rollNumber`: Unique within Batch
- `SubjectEnrollment`: Unique (subjectId, batchId) pair
- `AttendanceRecord`: Unique (studentId, sessionId) pair - allows upsert for corrections

## 🔐 Authentication Flow

### User Roles
- **TEACHER**: Full access to create/manage batches, subjects, attendance
- **STUDENT**: Read-only access to own dashboard and attendance data

### Signup & Verification Flow

```
1. POST /api/auth/signup (role: TEACHER or STUDENT)
   ↓
2. User created with verified=false
   ↓
3. Verification email sent with token
   ↓
4. GET /api/auth/verify-email?token=<token>
   ↓
5. User.verified = true
   ↓
6. POST /api/auth/login
   ↓
7. Returns: { accessToken, refreshToken, user }
```

### Authentication Headers

All protected routes require:
```
Authorization: Bearer <accessToken>
```

### Token Lifecycle

- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to obtain new access tokens

#### Refresh Token Flow

```
1. Access token expires → API returns 401
   ↓
2. POST /api/auth/refresh-token
   Headers: { Authorization: Bearer <refreshToken> }
   ↓
3. Returns new accessToken
   ↓
4. Retry original request with new token
```

### Example: Complete Auth Flow

```bash
# 1. Signup as Teacher
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@example.com",
    "password": "SecurePass123!",
    "name": "John Doe",
    "role": "TEACHER",
    "department": "Computer Science"
  }'

# Response: { "message": "Signup successful. Please check your email..." }

# 2. Verify Email (click link in email or call manually)
curl http://localhost:5000/api/auth/verify-email?token=<verification-token>

# 3. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@example.com",
    "password": "SecurePass123!"
  }'

# Response:
# {
#   "accessToken": "eyJhbGc...",
#   "refreshToken": "eyJhbGc...",
#   "user": { "id": "uuid", "email": "...", "role": "TEACHER", ... }
# }

# 4. Use Access Token for Protected Routes
curl http://localhost:5000/api/batches \
  -H "Authorization: Bearer eyJhbGc..."
```

## 📡 API Endpoints

Base URL: `http://localhost:5000/api`

### 🔑 Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/signup` | ❌ | Create new account (TEACHER or STUDENT) |
| POST | `/login` | ❌ | Login and receive tokens |
| POST | `/logout` | ✅ | Logout (clears tokens) |
| GET | `/verify-email?token=` | ❌ | Verify email address |
| POST | `/resend-verification` | ❌ | Resend verification email |
| POST | `/refresh-token` | ✅ Refresh | Get new access token |
| GET | `/me` | ✅ | Get current user profile |

**Request Examples:**

```bash
# Signup as Student
POST /api/auth/signup
{
  "email": "student@example.com",
  "password": "SecurePass123!",
  "name": "Jane Smith",
  "role": "STUDENT",
  "studentId": "CS2021001",  # Roll number (required for STUDENT)
  "batchId": "uuid-of-batch"  # Optional: link to existing batch
}

# Login
POST /api/auth/login
{
  "email": "teacher@example.com",
  "password": "SecurePass123!"
}
# Response: { accessToken, refreshToken, user }
```

### 📚 Batches (`/api/batches`)

**Teacher Only**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all batches (owned by teacher) |
| POST | `/` | Create new batch |
| GET | `/:batchId` | Get batch details with students |
| PUT | `/:batchId` | Update batch details |
| DELETE | `/:batchId` | Delete batch (cascades to students) |
| POST | `/:batchId/students/import` | Bulk import students via CSV |
| GET | `/:batchId/timetable` | Get batch timetable |
| PUT | `/:batchId/timetable` | Update batch timetable |

**Request Examples:**

```bash
# Create Batch
POST /api/batches
{
  "code": "CS-2024-A",
  "name": "Computer Science 2024 Batch A",
  "year": 2024,
  "semester": 1,
  "department": "Computer Science"
}

# Import Students (CSV upload)
POST /api/batches/:batchId/students/import
Content-Type: multipart/form-data
file: students.csv

# CSV Format (with headers):
studentId,firstName,lastName,email
CS2024001,John,Doe,john.doe@example.com
CS2024002,Jane,Smith,jane.smith@example.com

# Update Timetable
PUT /api/batches/:batchId/timetable
{
  "entries": [
    {
      "dayOfWeek": 1,  // Monday (0=Sunday, 6=Saturday)
      "startTime": "09:00:00",
      "endTime": "10:30:00",
      "subjectCode": "CS101",
      "subjectName": "Data Structures",
      "roomNumber": "Lab 3"
    },
    {
      "dayOfWeek": 2,  // Tuesday
      "startTime": "11:00:00",
      "endTime": "12:30:00",
      "subjectCode": "CS102",
      "subjectName": "Algorithms",
      "roomNumber": "Room 205"
    }
  ]
}
```

### 📖 Subjects (`/api/subjects`)

**Teacher Only**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all subjects (owned by teacher) |
| POST | `/` | Create new subject |
| GET | `/:subjectId` | Get subject details |
| PUT | `/:subjectId` | Update subject |
| DELETE | `/:subjectId` | Delete subject |

**Request Examples:**

```bash
# Create Subject
POST /api/subjects
{
  "code": "CS101",
  "name": "Data Structures and Algorithms",
  "credits": 4.5,  # Float values supported
  "department": "Computer Science",
  "description": "Core programming course"
}
```

### 🔗 Subject Enrollments (`/api/enrollments`)

**Teacher Only**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all enrollments |
| POST | `/enroll-batches` | Enroll multiple batches to a subject |
| GET | `/:enrollmentId` | Get enrollment details |
| GET | `/:enrollmentId/students` | Get students in this enrollment |
| DELETE | `/:enrollmentId` | Delete enrollment (removes subject from batch) |

**Request Examples:**

```bash
# Enroll Batches to Subject
POST /api/enrollments/enroll-batches
{
  "subjectId": "uuid-of-subject",
  "batchIds": [
    "uuid-of-batch-1",
    "uuid-of-batch-2"
  ]
}
# Uses upsert: safe to call multiple times (won't create duplicates)
```

### ✅ Attendance (`/api/attendance`)

**Teacher Routes:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sessions` | List all sessions (owned by teacher) |
| POST | `/sessions` | Create attendance session |
| GET | `/sessions/:sessionId` | Get session details with records |
| PUT | `/sessions/:sessionId` | Update session details |
| DELETE | `/sessions/:sessionId` | Delete session (cascades to records) |
| GET | `/sessions/:sessionId/students` | Get eligible students for marking |
| POST | `/sessions/:sessionId/mark` | Mark attendance for multiple students |

**Student Routes:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/students/me/summary` | Get attendance summary across all subjects |

**Request Examples:**

```bash
# Create Attendance Session
POST /api/attendance/sessions
{
  "subjectEnrollmentId": "uuid-of-enrollment",  # Batch + Subject
  "date": "2024-01-15",  # YYYY-MM-DD format
  "startTime": "09:00:00",  # HH:MM:SS format
  "endTime": "10:30:00",
  "topic": "Introduction to Linked Lists",
  "notes": "Covered single and double linked lists"
}

# Get Students for a Session
GET /api/attendance/sessions/:sessionId/students
# Returns: [{ id, studentId, name, email, rollNumber, isPresent: null }]

# Mark Attendance
POST /api/attendance/sessions/:sessionId/mark
{
  "records": [
    { "studentId": "uuid-student-1", "status": "PRESENT" },
    { "studentId": "uuid-student-2", "status": "ABSENT" },
    { "studentId": "uuid-student-3", "status": "LATE" }
  ]
}
# Uses upsert: can update existing records (allows corrections)
# Triggers: WebSocket events, push notifications, email alerts (if critical)
```

### 📊 Dashboard (`/api/dashboard`)

**Teacher Dashboard:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/teacher` | Get overview: enrollments, avg attendance, recent sessions |

**Student Dashboard:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/student` | Get enrolled subjects with attendance stats |

**Response Examples:**

```json
// Teacher Dashboard Response
{
  "enrollments": [
    {
      "id": "uuid",
      "subjectCode": "CS101",
      "subjectName": "Data Structures",
      "batchCode": "CS-2024-A",
      "totalStudents": 45,
      "totalSessions": 20,
      "averageAttendance": 82.5
    }
  ],
  "recentSessions": [...],
  "lowAttendanceAlerts": [
    {
      "studentName": "John Doe",
      "rollNumber": "CS2024001",
      "subjectCode": "CS101",
      "percentage": 68.2,
      "status": "WARNING"
    }
  ]
}

// Student Dashboard Response
{
  "subjects": [
    {
      "subjectCode": "CS101",
      "subjectName": "Data Structures",
      "batchCode": "CS-2024-A",
      "stats": {
        "totalSessions": 20,
        "attendedSessions": 17,
        "percentage": 85.0,
        "status": "GOOD",  // GOOD (>=75%), WARNING (65-74%), CRITICAL (<65%)
        "sessionsNeeded": 0
      }
    }
  ]
}
```

### 🔔 Notifications (`/api/notifications`)

**Student Routes:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/fcm-token` | Register FCM token for push notifications |
| DELETE | `/fcm-token` | Unregister FCM token |

**Request Examples:**

```bash
# Register FCM Token (for mobile app)
POST /api/notifications/fcm-token
{
  "token": "fcm-device-token-from-firebase",
  "deviceId": "unique-device-identifier"  # e.g., Android device ID
}
# Supports multiple devices per user

# Unregister FCM Token (on logout)
DELETE /api/notifications/fcm-token
{
  "token": "fcm-device-token-from-firebase"
}
```

### 👥 Students (`/api/students`)

**Teacher Routes:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:studentId` | Get student details with attendance stats |

**Response Example:**

```json
{
  "id": "uuid",
  "studentId": "CS2024001",
  "name": "John Doe",
  "email": "john@example.com",
  "batch": { "code": "CS-2024-A", "name": "..." },
  "enrollments": [
    {
      "subject": { "code": "CS101", "name": "Data Structures" },
      "stats": {
        "totalSessions": 20,
        "attendedSessions": 17,
        "percentage": 85.0,
        "status": "GOOD"
      }
    }
  ]
}
```

## 📦 Data Models

### User Roles

```typescript
type UserRole = "TEACHER" | "STUDENT";
```

### Attendance Status

```typescript
type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";
```

### Attendance Thresholds

- **GOOD**: ≥ 75% attendance (green status)
- **WARNING**: 65-74% attendance (yellow status)
- **CRITICAL**: < 65% attendance (red status, triggers email alert)

### Key DTOs (Data Transfer Objects)

```typescript
// Attendance Stats for a Subject
interface AttendanceStatsDTO {
  totalSessions: number;
  attendedSessions: number;
  percentage: number;
  status: "GOOD" | "WARNING" | "CRITICAL";
  sessionsNeeded: number;  // To reach 75%
}

// Attendance Session with Details
interface AttendanceSessionWithDetails {
  id: string;
  date: Date;
  startTime: string;  // "HH:MM:SS"
  endTime: string;
  topic?: string;
  notes?: string;
  subjectEnrollment: {
    subject: { code: string; name: string };
    batch: { code: string; name: string };
  };
  records: AttendanceRecord[];  // Who attended
}

// Student Import from CSV
interface ImportStudentDTO {
  studentId: string;  // Roll number
  firstName: string;
  lastName: string;
  email: string;
}
```

## 🔌 WebSocket Events

### Connection Setup

```javascript
// Frontend: Connect to WebSocket
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: accessToken  // JWT access token
  }
});

// Server automatically joins user to rooms:
// - "user:{userId}" for personal notifications
// - "batch:{batchId}" for batch-wide updates (if student)
```

### Events from Server → Client

#### 1. `attendance_marked` (Batch-wide)

Emitted when teacher marks attendance for a session.

```javascript
socket.on('attendance_marked', (event) => {
  // event structure:
  {
    type: "ATTENDANCE_MARKED",
    sessionId: "uuid",
    subjectCode: "CS101",
    subjectName: "Data Structures",
    batchCode: "CS-2024-A",
    date: "2024-01-15",
    startTime: "09:00:00",
    endTime: "10:30:00",
    markedCount: 42,  // Number of students marked
    timestamp: "2024-01-15T10:35:00.000Z"
  }
});
```

**Audience**: All students in the batch

#### 2. `attendance_updated` (Personal)

Emitted to individual student when their attendance changes.

```javascript
socket.on('attendance_updated', (event) => {
  // event structure:
  {
    type: "ATTENDANCE_UPDATED",
    subjectCode: "CS101",
    subjectName: "Data Structures",
    newPercentage: 72.5,
    status: "WARNING",  // or "GOOD" / "CRITICAL"
    stats: {
      totalSessions: 20,
      attendedSessions: 15,
      percentage: 72.5,
      status: "WARNING",
      sessionsNeeded: 2
    },
    timestamp: "2024-01-15T10:35:00.000Z"
  }
});
```

**Audience**: Specific student whose attendance was updated

#### 3. `low_attendance_alert` (Personal)

Emitted when student's attendance falls below thresholds.

```javascript
socket.on('low_attendance_alert', (event) => {
  // event structure:
  {
    type: "LOW_ATTENDANCE_ALERT",
    subjectCode: "CS101",
    subjectName: "Data Structures",
    percentage: 68.0,
    sessionsNeeded: 3,
    status: "WARNING",  // or "CRITICAL"
    message: "Warning: 68% attendance in Data Structures. Need 3 more classes to reach 75%.",
    timestamp: "2024-01-15T10:35:00.000Z"
  }
});
```

**Audience**: Specific student with low attendance

### Frontend Integration Tips

```javascript
// Example: React hook for WebSocket
useEffect(() => {
  const socket = io('http://localhost:5000', {
    auth: { token: localStorage.getItem('accessToken') }
  });

  socket.on('connect', () => {
    console.log('Connected to WebSocket');
  });

  socket.on('attendance_marked', (event) => {
    // Show toast notification
    toast.info(`Attendance marked for ${event.subjectName}`);
    // Refresh attendance list
    refetchAttendance();
  });

  socket.on('attendance_updated', (event) => {
    // Update local state
    updateSubjectAttendance(event.subjectCode, event.stats);
    if (event.status === 'CRITICAL') {
      toast.error(`Critical: ${event.newPercentage}% in ${event.subjectName}`);
    }
  });

  return () => socket.disconnect();
}, [accessToken]);
```

## 🔔 Notification System

### Notification Types

1. **LOW_ATTENDANCE**: Sent when attendance drops below thresholds
2. **ATTENDANCE_MARKED**: Sent when teacher marks attendance
3. *(More types can be added)*

### Notification Channels

#### 1. Push Notifications (Firebase Cloud Messaging)

- **Trigger**: All notification types
- **Audience**: Students with registered FCM tokens
- **Payload**:
  ```json
  {
    "notification": {
      "title": "Low Attendance Alert",
      "body": "Warning: 68% attendance in Data Structures"
    },
    "data": {
      "type": "LOW_ATTENDANCE",
      "subjectCode": "CS101",
      "percentage": "68.0",
      "status": "WARNING"
    }
  }
  ```
- **Multi-device Support**: Users can register multiple FCM tokens (phone + tablet)

#### 2. Email Notifications

- **Trigger**: Only for CRITICAL low attendance (< 65%)
- **Audience**: Student's registered email
- **Subject**: "⚠️ Critical Attendance Alert - [Subject Name]"
- **Content**: HTML email with attendance stats and action items

### Frontend: Registering for Push Notifications

```javascript
// 1. Get FCM token from Firebase SDK (mobile app)
import messaging from '@react-native-firebase/messaging';

const fcmToken = await messaging().getToken();

// 2. Register with backend
await fetch('http://localhost:5000/api/notifications/fcm-token', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    token: fcmToken,
    deviceId: DeviceInfo.getUniqueId()  // e.g., from react-native-device-info
  })
});

// 3. Handle incoming notifications
messaging().onMessage(async (remoteMessage) => {
  console.log('FCM Message:', remoteMessage);
  // Show local notification or update UI
});
```

## 🧪 Testing Examples

### Complete Workflow Test

```bash
# Set your access token (after login)
TOKEN="eyJhbGc..."

# 1. Create a Batch
curl -X POST http://localhost:5000/api/batches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CS-2024-A",
    "name": "Computer Science 2024 Batch A",
    "year": 2024,
    "semester": 1,
    "department": "Computer Science"
  }'
# Save batchId from response

# 2. Import Students (prepare students.csv first)
curl -X POST http://localhost:5000/api/batches/{batchId}/students/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@students.csv"

# 3. Create a Subject
curl -X POST http://localhost:5000/api/subjects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CS101",
    "name": "Data Structures",
    "credits": 4.0,
    "department": "Computer Science"
  }'
# Save subjectId from response

# 4. Enroll Batch to Subject
curl -X POST http://localhost:5000/api/enrollments/enroll-batches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subjectId": "{subjectId}",
    "batchIds": ["{batchId}"]
  }'
# Save enrollmentId from response

# 5. Create Attendance Session
curl -X POST http://localhost:5000/api/attendance/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subjectEnrollmentId": "{enrollmentId}",
    "date": "2024-01-15",
    "startTime": "09:00:00",
    "endTime": "10:30:00",
    "topic": "Introduction to Linked Lists"
  }'
# Save sessionId from response

# 6. Get Students for Marking
curl http://localhost:5000/api/attendance/sessions/{sessionId}/students \
  -H "Authorization: Bearer $TOKEN"
# Copy student UUIDs from response

# 7. Mark Attendance
curl -X POST http://localhost:5000/api/attendance/sessions/{sessionId}/mark \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      { "studentId": "{studentId1}", "status": "PRESENT" },
      { "studentId": "{studentId2}", "status": "ABSENT" },
      { "studentId": "{studentId3}", "status": "LATE" }
    ]
  }'
# Triggers: WebSocket events, FCM push, email (if critical)

# 8. Check Teacher Dashboard
curl http://localhost:5000/api/dashboard/teacher \
  -H "Authorization: Bearer $TOKEN"

# 9. Login as Student and Check Dashboard
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "StudentPass123!"
  }'
# Get student access token

curl http://localhost:5000/api/dashboard/student \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```

### Error Handling Examples

```bash
# 401 Unauthorized (no token)
curl http://localhost:5000/api/batches
# Response: { "error": "No token provided" }

# 401 Unauthorized (invalid token)
curl http://localhost:5000/api/batches \
  -H "Authorization: Bearer invalid-token"
# Response: { "error": "Invalid token" }

# 403 Forbidden (student accessing teacher route)
curl http://localhost:5000/api/batches \
  -H "Authorization: Bearer $STUDENT_TOKEN"
# Response: { "error": "Access denied. Required role: TEACHER" }

# 400 Bad Request (validation error)
curl -X POST http://localhost:5000/api/subjects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "code": "CS101" }'  # Missing required fields
# Response: { "error": "Validation error", "details": [...] }

# 404 Not Found
curl http://localhost:5000/api/batches/non-existent-uuid \
  -H "Authorization: Bearer $TOKEN"
# Response: { "error": "Batch not found" }
```

## 🚀 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000

# Use production database URL
DATABASE_URL="postgresql://user:password@production-host/database?sslmode=require"

# Strong secrets (generate with: openssl rand -base64 32)
ACCESS_TOKEN_SECRET="<64-char-random-string>"
REFRESH_TOKEN_SECRET="<64-char-random-string>"

# Production frontend URL
FRONTEND_URL="https://your-frontend-app.com"

# Stricter rate limiting
RATE_LIMIT_WINDOW_MS=60000  # 1 minute
RATE_LIMIT_MAX_REQUESTS=30
```

### Build and Deploy

```bash
# 1. Build the application
bun run build

# 2. Run migrations on production database
bun run prisma:deploy

# 3. Start production server
bun run start

# Or use PM2 for process management
pm2 start dist/index.js --name attendease-backend
```

### Deployment Platforms

- **Recommended**: Railway, Render, Fly.io (support Bun)
- **Database**: Neon (serverless PostgreSQL)
- **File Storage**: If adding file uploads, use AWS S3 or Cloudinary

### Health Check Endpoint

```bash
# Check if server is running
curl http://localhost:5000/
# Response: "Hello, World!"
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Email Verification Not Working

**Problem**: Emails not sending
**Solution**:
- Verify Gmail app password (not regular password)
- Check `.env`: `EMAIL_SECURE=false` for port 587
- Test email credentials: `bun run test-email` (if you create a test script)
- Check spam folder

#### 2. Database Connection Errors

**Problem**: `Prisma Client could not connect`
**Solution**:
- Verify `DATABASE_URL` in `.env`
- Check Neon dashboard for database status
- Ensure `?sslmode=require` is in connection string
- Run `bun run prisma:generate` after changing schema

#### 3. JWT Token Errors

**Problem**: `Invalid token` or `Token expired`
**Solution**:
- Check token expiry settings in `.env`
- Use refresh token endpoint to get new access token
- Ensure `Authorization: Bearer <token>` header format
- Verify secrets match between token generation and verification

#### 4. CSV Import Failing

**Problem**: "Validation error" during student import
**Solution**:
- Ensure CSV has headers: `studentId,firstName,lastName,email`
- Use exact column names (case-sensitive)
- Check for UTF-8 encoding (not UTF-8 BOM)
- Remove special characters from student IDs
- Example valid CSV:
  ```csv
  studentId,firstName,lastName,email
  CS2024001,John,Doe,john@example.com
  ```

#### 5. WebSocket Not Connecting

**Problem**: Real-time notifications not working
**Solution**:
- Check CORS settings in `src/app.ts`
- Ensure client uses correct URL: `http://localhost:5000` (not `/api`)
- Verify JWT token is passed in `auth.token` during connection
- Check browser console for Socket.IO errors

#### 6. Push Notifications Not Received

**Problem**: FCM push not working
**Solution**:
- Verify Firebase credentials in `.env`
- Check FCM token registration: `POST /api/notifications/fcm-token`
- Ensure Firebase project has FCM enabled
- Test with Firebase Console → Cloud Messaging → Send test message
- Check mobile app FCM permissions

#### 7. Attendance Stats Showing 0%

**Problem**: Dashboard shows 0 attendance for all subjects
**Solution**:
- Verify attendance sessions exist: `GET /api/attendance/sessions`
- Check enrollment: `GET /api/enrollments/:enrollmentId/students`
- Ensure student is in the batch enrolled in subject
- Mark at least one attendance: `POST /api/attendance/sessions/:sessionId/mark`

### Debug Mode

Enable detailed logging:

```env
NODE_ENV=development  # Enables verbose Winston logs
```

Check logs in `logs/` directory:
- `error.log`: Error-level logs
- `combined.log`: All logs

### API Testing Tools

- **Postman**: Import collection (create from endpoints above)
- **Thunder Client** (VS Code extension): Lightweight alternative
- **curl**: For quick terminal testing

### Database Inspection

```bash
# Open Prisma Studio (visual database browser)
bun run prisma:studio

# Navigate to http://localhost:5555
# View all tables, data, and relationships
```

## 📚 Additional Resources

### Frontend Integration Checklist

- [ ] Implement JWT token storage (localStorage/AsyncStorage)
- [ ] Create axios/fetch interceptor for Authorization headers
- [ ] Handle 401 errors with automatic token refresh
- [ ] Set up Socket.IO client with JWT authentication
- [ ] Implement FCM token registration on app launch
- [ ] Create notification handlers for WebSocket events
- [ ] Build UI for attendance stats with color-coded status
- [ ] Add CSV file picker for student import
- [ ] Implement form validation matching Zod schemas
- [ ] Handle loading states and error messages

### Useful Prisma Commands

```bash
# View current database state
bun run prisma:studio

# Create migration after schema change
bun run prisma:migrate

# Reset database (development only!)
bun run db:reset

# Generate Prisma Client after git pull
bun run prisma:generate

# Prototype schema changes (no migration)
bun run db:push
```

### Security Best Practices

- ✅ Never commit `.env` file (add to `.gitignore`)
- ✅ Use HTTPS in production (not HTTP)
- ✅ Rotate JWT secrets periodically
- ✅ Implement rate limiting (already configured)
- ✅ Validate all user input (Zod schemas handle this)
- ✅ Use parameterized queries (Prisma prevents SQL injection)
- ✅ Enable CORS only for trusted origins (update in `src/app.ts`)
- ✅ Keep dependencies updated: `bun update`

## 📄 License

This project is private and proprietary.

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m 'Add your feature'`
3. Push branch: `git push origin feature/your-feature`
4. Open Pull Request

---

**Built with ❤️ using Bun, Express, Prisma, and TypeScript**

For questions or support, contact: [your-email@example.com] [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
