/*
  Warnings:

  - You are about to drop the column `endDate` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Meeting` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `Meeting` table. All the data in the column will be lost.
  - Added the required column `endDateTime` to the `Meeting` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDateTime` to the `Meeting` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Meeting" DROP COLUMN "endDate",
DROP COLUMN "endTime",
DROP COLUMN "startDate",
DROP COLUMN "startTime",
ADD COLUMN     "endDateTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "startDateTime" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."MeetingInvitee" (
    "id" SERIAL NOT NULL,
    "meetingId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingInvitee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingInvitee_meetingId_userId_key" ON "public"."MeetingInvitee"("meetingId", "userId");

-- AddForeignKey
ALTER TABLE "public"."MeetingInvitee" ADD CONSTRAINT "MeetingInvitee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MeetingInvitee" ADD CONSTRAINT "MeetingInvitee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
