-- CreateEnum
CREATE TYPE "City" AS ENUM ('TRIPOLI');

-- Cities were typed by hand, in the admin's language ("طرابلس" or
-- "Tripoli"). Anything else becomes NULL and fails the NOT NULL check, so
-- the migration stops instead of filing a branch under the wrong city.
ALTER TABLE "branches" ALTER COLUMN "city" TYPE "City" USING (
  CASE
    WHEN lower(trim("city")) IN ('tripoli', 'طرابلس') THEN 'TRIPOLI'::"City"
  END
);
