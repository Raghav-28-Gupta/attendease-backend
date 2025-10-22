/*
  Warnings:

  - You are about to drop the column `batchId` on the `attendance_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `subjectId` on the `attendance_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `room` on the `batches` table. All the data in the column will be lost.
  - You are about to drop the column `subjectId` on the `batches` table. All the data in the column will be lost.
  - You are about to drop the column `room` on the `timetable_entries` table. All the data in the column will be lost.
  - Added the required column `subjectEnrollmentId` to the `attendance_sessions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `department` to the `batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year` to the `batches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subjectEnrollmentId` to the `timetable_entries` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."attendance_sessions" DROP CONSTRAINT "attendance_sessions_batchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."attendance_sessions" DROP CONSTRAINT "attendance_sessions_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "public"."batches" DROP CONSTRAINT "batches_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "public"."subjects" DROP CONSTRAINT "subjects_teacherId_fkey";

-- DropIndex
DROP INDEX "public"."attendance_sessions_batchId_idx";

-- DropIndex
DROP INDEX "public"."attendance_sessions_subjectId_idx";

-- DropIndex
DROP INDEX "public"."batches_subjectId_idx";

-- DropIndex
DROP INDEX "public"."subjects_teacherId_idx";

-- AlterTable
ALTER TABLE "attendance_sessions" DROP COLUMN "batchId",
DROP COLUMN "subjectId",
ADD COLUMN     "subjectEnrollmentId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "batches" DROP COLUMN "room",
DROP COLUMN "subjectId",
ADD COLUMN     "classRoom" TEXT,
ADD COLUMN     "department" TEXT NOT NULL,
ADD COLUMN     "year" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "students" ALTER COLUMN "batchId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "credits" INTEGER,
ALTER COLUMN "teacherId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "timetable_entries" DROP COLUMN "room",
ADD COLUMN     "classRoom" TEXT,
ADD COLUMN     "subjectEnrollmentId" TEXT NOT NULL,
ADD COLUMN     "type" TEXT,
ALTER COLUMN "professor" DROP NOT NULL;

-- CreateTable
CREATE TABLE "subject_enrollments" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "semester" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "room" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subject_enrollments_subjectId_idx" ON "subject_enrollments"("subjectId");

-- CreateIndex
CREATE INDEX "subject_enrollments_batchId_idx" ON "subject_enrollments"("batchId");

-- CreateIndex
CREATE INDEX "subject_enrollments_teacherId_idx" ON "subject_enrollments"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "subject_enrollments_subjectId_batchId_key" ON "subject_enrollments"("subjectId", "batchId");

-- CreateIndex
CREATE INDEX "attendance_sessions_subjectEnrollmentId_idx" ON "attendance_sessions"("subjectEnrollmentId");

-- CreateIndex
CREATE INDEX "batches_department_idx" ON "batches"("department");

-- CreateIndex
CREATE INDEX "timetable_entries_subjectEnrollmentId_idx" ON "timetable_entries"("subjectEnrollmentId");

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_enrollments" ADD CONSTRAINT "subject_enrollments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_enrollments" ADD CONSTRAINT "subject_enrollments_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_enrollments" ADD CONSTRAINT "subject_enrollments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_subjectEnrollmentId_fkey" FOREIGN KEY ("subjectEnrollmentId") REFERENCES "subject_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_subjectEnrollmentId_fkey" FOREIGN KEY ("subjectEnrollmentId") REFERENCES "subject_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
