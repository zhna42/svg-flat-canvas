import type { Command } from './types';
import type { CommandHandler, CommandRegistry } from './registry';
import type { TimeMachine } from '@/time-machine';

export class CommandBus {
  private readonly handlers: CommandRegistry = {};
  private readonly timeMachine: TimeMachine;

  public constructor(timeMachine: TimeMachine) {
    this.timeMachine = timeMachine;
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

    if (command.type === 'DRAG_MOVE' || command.type === 'SELECT') return;

    this.timeMachine.push(command.type);
  }

  public getTimeMachine(): TimeMachine {
    return this.timeMachine;
  }
}
