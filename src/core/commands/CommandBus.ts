import type {
  Command,
  CommandHandler,
  CommandRegistry,
} from '@/core/commands/types';
import type { EventBus } from '@/core/event-bus/EventBus';

export class CommandBus {
  private readonly handlers: CommandRegistry = {};
  private readonly events: EventBus;

  public constructor(events: EventBus) {
    this.events = events;
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

  public emit(event: string, data: Record<string, unknown>): void {
    this.events.emit(event, data);
  }
}
