-- AlterTable
ALTER TABLE "public"."Issue" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" INTEGER,
ADD COLUMN     "resolution" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
