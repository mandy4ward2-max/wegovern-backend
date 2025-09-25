/*
  Warnings:

  - Added the required column `title` to the `AgendaItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `AgendaItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."AgendaItem" ADD COLUMN     "isSubSection" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "parentSectionId" INTEGER,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL,
ALTER COLUMN "agendaItem" DROP NOT NULL;
