-- CreateEnum
CREATE TYPE "GymBasicSessionType" AS ENUM ('spa', 'jacuzzi', 'sauna');

-- CreateTable
CREATE TABLE "gym_basic_sessions" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "type" "GymBasicSessionType" NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_basic_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_basic_session_bookings" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "paid_amount" DOUBLE PRECISION NOT NULL,
    "payment_method" TEXT NOT NULL,
    "status" "GymClassBookingStatus" NOT NULL DEFAULT 'booked',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_basic_session_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gym_basic_sessions_gym_id_type_key" ON "gym_basic_sessions"("gym_id", "type");

-- CreateIndex
CREATE INDEX "gym_basic_sessions_gym_id_is_active_idx" ON "gym_basic_sessions"("gym_id", "is_active");

-- CreateIndex
CREATE INDEX "gym_basic_session_bookings_gym_id_created_at_idx" ON "gym_basic_session_bookings"("gym_id", "created_at");

-- CreateIndex
CREATE INDEX "gym_basic_session_bookings_session_id_idx" ON "gym_basic_session_bookings"("session_id");

-- CreateIndex
CREATE INDEX "gym_basic_session_bookings_user_id_idx" ON "gym_basic_session_bookings"("user_id");

-- AddForeignKey
ALTER TABLE "gym_basic_sessions" ADD CONSTRAINT "gym_basic_sessions_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_basic_session_bookings" ADD CONSTRAINT "gym_basic_session_bookings_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_basic_session_bookings" ADD CONSTRAINT "gym_basic_session_bookings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "gym_basic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_basic_session_bookings" ADD CONSTRAINT "gym_basic_session_bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
