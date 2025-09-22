/*
  Warnings:

  - You are about to drop the column `motionText` on the `Motion` table. All the data in the column will be lost.
  - Added the required column `motion` to the `Motion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Motion" DROP COLUMN "motionText",
ADD COLUMN     "motion" TEXT NOT NULL;
