-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'Member';

-- Update existing data: convert isSuperUser boolean to role string
UPDATE "User" SET "role" = CASE 
  WHEN "isSuperUser" = true THEN 'SuperUser'
  ELSE 'Member'
END;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isSuperUser";