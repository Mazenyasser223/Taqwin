-- Add geographic coordinates for gym map discovery
ALTER TABLE "gyms" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "gyms" ADD COLUMN "longitude" DOUBLE PRECISION;

CREATE INDEX "gyms_latitude_longitude_idx" ON "gyms"("latitude", "longitude");
