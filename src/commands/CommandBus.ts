import type { Command } from './types';
import type { CommandHandler, CommandRegistry } from './registry';
import type { TimeMachine } from '@/time-machine';
import { CommandTracker } from './CommandTracker';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { EventBus } from '@/core/EventBus';

export class CommandBus {
  private readonly handlers: CommandRegistry = {};
  private readonly timeMachine: TimeMachine;
  private readonly tracker: CommandTracker;
  private readonly events: EventBus;
  private getElement: (id: string) => AbstractGraphicElement | undefined = () => undefined;
  private getSelected: (() => string[]) | undefined;

  public constructor(timeMachine: TimeMachine, tracker: CommandTracker, events: EventBus) {
    this.timeMachine = timeMachine;
    this.tracker = tracker;
    this.events = events;
  }

  public setGetElement(fn: (id: string) => AbstractGraphicElement | undefined): void {
    this.getElement = fn;
  }

  public setGetSelected(fn: () => string[]): void {
    this.getSelected = fn;
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

    const ids = this.extractIds(command);

    if (command.type !== 'DRAG_END' && ids.length > 0) {
      this.tracker.captureBefore(ids, this.getElement);
    }

    handler(command);

    if (command.type === 'DRAG_MOVE') return;

    if (command.type === 'DRAG_END') {
      if (ids.length > 0) {
        const cmd = command as any;
        this.tracker.emitDiff(command.type, ids, this.getElement, cmd.options?.mode ?? 'element');
      }
      this.timeMachine.push(command.type);
      return;
    }

    if (command.type === 'SELECT') {
      const selected = this.getSelected?.() ?? [];
      const mode = (command as any).options?.mode ?? 'element';
      this.events.emit('SVG_CAD_SELECT', {
        type: 'SVG_CAD_SELECT',
        mode,
        elementIds: selected,
        diff: {},
      });
      return;
    }

    if (ids.length > 0) {
      this.tracker.emitDiff(command.type, ids, this.getElement);
    }

    this.timeMachine.push(command.type);
  }

  public getTracker(): CommandTracker {
    return this.tracker;
  }

  public getTimeMachine(): TimeMachine {
    return this.timeMachine;
  }

  private extractIds(command: Command): string[] {
    const opts = (command as any).options ?? {};
    if (opts.elementIds) return opts.elementIds;
    if (opts.element) return [opts.element.id];
    if (opts.elements) return opts.elements.map((e: any) => e.id);
    if (opts.id) return [opts.id];
    if (opts.groupId) return [];
    return [];
  }
}
