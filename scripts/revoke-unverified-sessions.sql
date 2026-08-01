-- One-time cleanup after enabling mandatory email verification.
-- Revokes active sessions for users who have not verified their email yet.

DELETE FROM session
WHERE "userId" IN (
  SELECT id FROM "user" WHERE "emailVerified" = false
);
