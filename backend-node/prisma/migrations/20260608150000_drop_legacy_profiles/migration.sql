-- Legacy profiles table was removed by split_profiles_remove_trainer.
-- Drop only if an out-of-band repair recreated it (no-op on fresh CI/production DBs).
DROP TABLE IF EXISTS "profiles";
