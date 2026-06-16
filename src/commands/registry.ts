import type { Command } from './types';

export type CommandHandler = (
  command: Command,
) => void | { affected: { kind: string; id: string }[] };

export interface CommandRegistry {
  [type: string]: CommandHandler;
}
