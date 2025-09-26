/*
  Warnings:

  - You are about to drop the column `motionId` on the `Attachment` table. All the data in the column will be lost.
  - You are about to drop the `AgendaAttachment` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `entityId` to the `Attachment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityType` to the `Attachment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."AgendaAttachment" DROP CONSTRAINT "AgendaAttachment_agendaItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."AgendaAttachment" DROP CONSTRAINT "AgendaAttachment_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."Attachment" DROP CONSTRAINT "Attachment_motionId_fkey";

-- AlterTable
ALTER TABLE "public"."Attachment" DROP COLUMN "motionId",
ADD COLUMN     "entityId" INTEGER NOT NULL,
ADD COLUMN     "entityType" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "originalName" TEXT,
ADD COLUMN     "size" INTEGER;

-- DropTable
DROP TABLE "public"."AgendaAttachment";
