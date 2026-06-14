-- Optional structured perks on subscription plans (freeze weeks, invitations, coach sessions)
ALTER TABLE "gym_subscription_plans" ADD COLUMN IF NOT EXISTS "benefits" JSONB;
