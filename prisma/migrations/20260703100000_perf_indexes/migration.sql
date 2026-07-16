-- Composite indexes for recurring due queries, wallet-filtered transactions, and auth maintenance.

CREATE INDEX IF NOT EXISTS "session_expiresAt_idx" ON "session"("expiresAt");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier");
CREATE INDEX IF NOT EXISTS "transactions_userId_walletId_occurredAt_idx" ON "transactions"("userId", "walletId", "occurredAt");
CREATE INDEX IF NOT EXISTS "recurring_transactions_userId_isActive_nextDueAt_idx" ON "recurring_transactions"("userId", "isActive", "nextDueAt");
