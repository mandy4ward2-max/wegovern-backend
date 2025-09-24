-- CreateTable
CREATE TABLE "public"."_CommentTags" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CommentTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CommentTags_B_index" ON "public"."_CommentTags"("B");

-- AddForeignKey
ALTER TABLE "public"."_CommentTags" ADD CONSTRAINT "_CommentTags_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_CommentTags" ADD CONSTRAINT "_CommentTags_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
