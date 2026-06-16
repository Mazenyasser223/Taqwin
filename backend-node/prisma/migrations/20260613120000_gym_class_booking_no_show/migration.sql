-- Add no_show status for class bookings who did not attend
ALTER TYPE "GymClassBookingStatus" ADD VALUE IF NOT EXISTS 'no_show';
