-- Additive enum value for first-class MiniMax Token Plan support.
-- Safe and non-destructive: existing AiProviderConfig rows are unchanged.

ALTER TYPE "AiProvider" ADD VALUE 'MINIMAX';
