import type { Command } from './types';
import type { CommandHandler, CommandRegistry } from './registry';
import type { TimeMachine } from '@/time-machine';
import type { AbstractGraphicElement } from '@/shapes/elements/AbstractGraphicElement';
import type { EventBus } from '@/core/EventBus';

const EDIT_COMMANDS = new Set([
  'DRAG_END', 'RESIZE', 'ROTATE', 'TRANSFORM',
  'GEOMETRY_MUTATE', 'PATH_ADD_NODE', 'PATH_CHANGE_NODE_TYPE',
  'PATH_REMOVE_NODE', 'PATH_MOVE_SUBPATH',
]);

export class CommandBus {
  private readonly handlers: CommandRegistry = {};
  private readonly timeMachine: TimeMachine;
  private readonly events: EventBus;
  private getSelected: (() => string[]) | undefined;
  private getElement: ((id: string) => AbstractGraphicElement | undefined) | undefined;
  public suppressTimeMachine = false;

  public constructor(timeMachine: TimeMachine, events: EventBus) {
    this.timeMachine = timeMachine;
    this.events = events;
  }

  public setGetSelected(fn: () => string[]): void {
    this.getSelected = fn;
  }

  public setGetElement(fn: (id: string) => AbstractGraphicElement | undefined): void {
    this.getElement = fn;
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

    if (command.type === 'DRAG_MOVE') {
      handler(command);
      return;
    }

    if (command.type === 'SELECT') {
      handler(command);
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

    const beforeSnapshots = this.captureBeforeSnapshots(ids);

    handler(command);

    if (!this.suppressTimeMachine && EDIT_COMMANDS.has(command.type)) {
      const fullSnapshotIds: string[] = [];
      const diffElements: AbstractGraphicElement[] = [];

      for (const id of ids) {
        const before = beforeSnapshots.get(id);
        const el = this.getElement?.(id);
        if (!el) {
          if (before) fullSnapshotIds.push(id);
        } else {
          diffElements.push(el);
        }
      }

      this.timeMachine.push(
        command.type as any,
        ids,
        'element',
        fullSnapshotIds,
        diffElements,
      );
    }

    if (!this.suppressTimeMachine && command.type === 'DELETE') {
      this.timeMachine.push(
        'DELETE',
        ids,
        'element',
        ids,
        [],
      );
    }

    if (!this.suppressTimeMachine && (command.type === 'CREATE' || command.type === 'CREATE_FILE')) {
      const newIds = this.extractIds(command);
      const newElements: AbstractGraphicElement[] = [];
      for (const id of newIds) {
        const el = this.getElement?.(id);
        if (el) newElements.push(el);
      }
      this.timeMachine.push(
        command.type as any,
        newIds,
        'element',
        newIds,
        [],
      );
    }

    if (!this.suppressTimeMachine && (command.type === 'GROUP_CREATE' || command.type === 'GROUP_DELETE' ||
        command.type === 'GROUP_ADD' || command.type === 'GROUP_REMOVE' ||
        command.type === 'GROUP_CLEAR')) {
      this.timeMachine.push(
        command.type as any,
        [],
        'group',
        [],
        [],
      );
    }
  }

  public getTimeMachine(): TimeMachine {
    return this.timeMachine;
  }

  private captureBeforeSnapshots(ids: string[]): Map<string, Record<string, unknown>> {
    const map = new Map<string, Record<string, unknown>>();
    for (const id of ids) {
      const el = this.getElement?.(id);
      if (el) {
        map.set(id, el.toSnapshot());
      }
    }
    return map;
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
