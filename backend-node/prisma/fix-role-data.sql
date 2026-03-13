-- Update existing user roles to match the new enum
UPDATE users SET role = 'athlete' WHERE role = 'user';
UPDATE users SET role = 'gym' WHERE role = 'gym_owner';
