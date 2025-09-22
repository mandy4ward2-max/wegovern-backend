-- AlterTable
ALTER TABLE "public"."Organization" ADD COLUMN     "majorityVoteNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "ownerUserId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Organization" ADD CONSTRAINT "Organization_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
