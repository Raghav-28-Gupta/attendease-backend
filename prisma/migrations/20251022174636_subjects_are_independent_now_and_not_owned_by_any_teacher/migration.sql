/*
  Warnings:

  - You are about to drop the column `teacherId` on the `subjects` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."subjects" DROP CONSTRAINT "subjects_teacherId_fkey";

-- AlterTable
ALTER TABLE "subjects" DROP COLUMN "teacherId";
