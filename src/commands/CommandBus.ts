import type { Command } from './types';
import type { CommandHandler, CommandRegistry } from './registry';
import { CommandHistory } from './CommandHistory';

export class CommandBus {
  private readonly handlers: CommandRegistry = {};
  private readonly history: CommandHistory;

  public constructor(history?: CommandHistory) {
    this.history = history ?? new CommandHistory();
  }

  public register(type: string, handler: CommandHandler): void {
    this.handlers[type] = handler;
  }

  public execute(command: Command): void {
    const handler = this.handlers[command.type];
    if (!handler) {
      console.warn(`[CommandBus] No handler for type: ${command.type}`);
      return;
    }
    handler(command);
  }

  public getHistory(): CommandHistory {
    return this.history;
  }
}
