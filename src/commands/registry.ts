import type { Command } from './types';

export type CommandHandler = (command: Command) => void;

export interface CommandRegistry {
  [type: string]: CommandHandler;
}
