-- Promote platform shop admin (idempotent).
UPDATE users
SET role = 'admin'
WHERE email = 'ziad74488@gmail.com'
  AND role IS DISTINCT FROM 'admin';
