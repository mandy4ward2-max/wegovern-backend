/*
  Warnings:

  - You are about to drop the column `completedDate` on the `Motion` table. All the data in the column will be lost.
  - You are about to drop the column `dateSubmitted` on the `Motion` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Motion` table. All the data in the column will be lost.
  - You are about to drop the column `submittedById` on the `Motion` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Motion` table. All the data in the column will be lost.
  - You are about to drop the column `votesAgainst` on the `Motion` table. All the data in the column will be lost.
  - You are about to drop the column `votesFor` on the `Motion` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `ssoProvider` on the `User` table. All the data in the column will be lost.
  - Added the required column `userId` to the `Motion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('UNAPPROVED', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- DropForeignKey
ALTER TABLE "public"."Motion" DROP CONSTRAINT "Motion_submittedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."Task" DROP CONSTRAINT "Task_motionId_fkey";

-- AlterTable
ALTER TABLE "public"."Attachment" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "public"."Comment" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Motion" DROP COLUMN "completedDate",
DROP COLUMN "dateSubmitted",
DROP COLUMN "description",
DROP COLUMN "submittedById",
DROP COLUMN "title",
DROP COLUMN "votesAgainst",
DROP COLUMN "votesFor",
ADD COLUMN     "dateVoted" TIMESTAMP(3),
ADD COLUMN     "discussion" TEXT,
ADD COLUMN     "issueId" INTEGER,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "userId" INTEGER NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "public"."Task" ADD COLUMN     "issueId" INTEGER,
ADD COLUMN     "status" "public"."TaskStatus" NOT NULL DEFAULT 'UNAPPROVED',
ALTER COLUMN "motionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "passwordHash",
DROP COLUMN "ssoProvider",
ADD COLUMN     "password" TEXT NOT NULL,
ALTER COLUMN "role" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."Issue" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "orgId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "assignedToId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Motion" ADD CONSTRAINT "Motion_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Motion" ADD CONSTRAINT "Motion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_motionId_fkey" FOREIGN KEY ("motionId") REFERENCES "public"."Motion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attachment" ADD CONSTRAINT "Attachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
