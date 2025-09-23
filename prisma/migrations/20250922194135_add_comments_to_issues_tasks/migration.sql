-- DropForeignKey
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_motionId_fkey";

-- AlterTable
ALTER TABLE "public"."Comment" ADD COLUMN     "issueId" INTEGER,
ADD COLUMN     "taskId" INTEGER,
ALTER COLUMN "motionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_motionId_fkey" FOREIGN KEY ("motionId") REFERENCES "public"."Motion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
