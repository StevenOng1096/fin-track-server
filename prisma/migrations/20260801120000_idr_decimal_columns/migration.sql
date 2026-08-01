-- Store IDR amounts as DECIMAL(20,2), e.g. 495.04 stored directly.

ALTER TABLE wallet_balances
  ALTER COLUMN balance TYPE DECIMAL(20, 2) USING (balance::numeric);

ALTER TABLE transactions
  ALTER COLUMN amount TYPE DECIMAL(20, 2) USING (amount::numeric);

ALTER TABLE recurring_transactions
  ALTER COLUMN amount TYPE DECIMAL(20, 2) USING (amount::numeric);

ALTER TABLE asset_transactions
  ALTER COLUMN "totalValueIdr" TYPE DECIMAL(20, 2) USING ("totalValueIdr"::numeric);
