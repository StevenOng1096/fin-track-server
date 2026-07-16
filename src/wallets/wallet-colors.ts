export const WALLET_COLOR_KEYS = [
  'rose',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'teal',
  'sky',
  'blue',
  'indigo',
  'violet',
  'pink',
] as const;

export type WalletColorKey = (typeof WALLET_COLOR_KEYS)[number];

export const DEFAULT_WALLET_COLOR: WalletColorKey = 'sky';

export function isWalletColor(value: string): value is WalletColorKey {
  return (WALLET_COLOR_KEYS as readonly string[]).includes(value);
}
