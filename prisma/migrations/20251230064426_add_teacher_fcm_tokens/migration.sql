-- AlterTable
ALTER TABLE "fcm_tokens" ADD COLUMN     "teacherId" TEXT,
ALTER COLUMN "studentId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "fcm_tokens_teacherId_idx" ON "fcm_tokens"("teacherId");

-- AddForeignKey
ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
