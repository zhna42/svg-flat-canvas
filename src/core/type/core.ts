export type DiffValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | unknown[]
  | Record<string, unknown>;
export type DiffData = Record<string, DiffValue>;
export type SubscriptionCallback = (newValue: unknown, path: string) => void;
