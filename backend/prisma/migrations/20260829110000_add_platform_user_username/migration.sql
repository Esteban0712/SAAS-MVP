-- Add the column as nullable so existing platform users can be preserved.
ALTER TABLE "PlatformUser" ADD COLUMN "username" TEXT;

-- Produce a stable, unique username for any existing row before enforcing it.
UPDATE "PlatformUser"
SET "username" = LOWER(REGEXP_REPLACE(SPLIT_PART("email", '@', 1), '[^a-zA-Z0-9_]+', '_', 'g'))
  || '_' || SUBSTRING("id"::TEXT, 1, 8)
WHERE "username" IS NULL;

ALTER TABLE "PlatformUser" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "PlatformUser_username_key" ON "PlatformUser"("username");
