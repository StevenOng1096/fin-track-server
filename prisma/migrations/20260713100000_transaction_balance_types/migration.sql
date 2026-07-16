-- Add initial balance and adjustment transaction types
ALTER TYPE "TransactionType" ADD VALUE 'INITIAL_BALANCE';
ALTER TYPE "TransactionType" ADD VALUE 'ADJUSTMENT';
