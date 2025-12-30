-- This migration adds teacher FCM token support
-- Run when database is available:
-- npx prisma migrate dev --name add_teacher_fcm_tokens

-- AlterTable: Make studentId optional and add teacherId
ALTER TABLE "fcm_tokens" ALTER COLUMN "studentId" DROP NOT NULL;
ALTER TABLE "fcm_tokens" ADD COLUMN IF NOT EXISTS "teacherId" TEXT;

-- CreateIndex: Add index for teacherId
CREATE INDEX IF NOT EXISTS "fcm_tokens_teacherId_idx" ON "fcm_tokens"("teacherId");

-- AddForeignKey
ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
