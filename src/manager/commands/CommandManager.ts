import type { ICanvasContext } from '@/canvas/types';
import type { AbstractGraphicElement } from '@/core/shapes/elements/AbstractGraphicElement';
import type { CommandHandler, Command } from '@/core/commands/types';
import { createSelectHandler } from '@/core/commands/handlers/select-handler';
import {
  createDragMoveHandler,
  createDragEndHandler,
} from '@/core/commands/handlers/drag-handler';
import { createGroupHandler } from '@/manager/commands/handlers/group-handler';
import { createDeleteHandler } from '@/manager/commands/handlers/delete-handler';
import { createCreateHandler } from '@/manager/commands/handlers/create-handler';
import { createCreateFileHandler } from '@/manager/commands/handlers/create-file-handler';
import { createBooleanOperationHandler } from '@/manager/commands/handlers/boolean-handler';
import { PathElement } from '@/core/shapes/elements/PathElement';

const EDIT_COMMANDS = new Set([
  'DRAG_END',
  'RESIZE',
  'ROTATE',
  'TRANSFORM',
  'GEOMETRY_MUTATE',
  'PATH_ADD_NODE',
  'PATH_CHANGE_NODE_TYPE',
  'PATH_REMOVE_NODE',
  'PATH_MOVE_SUBPATH',
  'GROUP_CREATE',
  'GROUP_DELETE',
  'GROUP_ADD',
  'GROUP_REMOVE',
  'GROUP_CLEAR',
]);

export class CommandManager {
  constructor(private readonly ctx: ICanvasContext) {}

  registerAll(): void {
    this.registerElementCommands();
    this.registerPathCommands();
    this.registerTransformCommands();
    this.registerGroupCommands();
  }

  private undoable(cmdType: string, handler: CommandHandler): CommandHandler {
    const { timeMachine, shapeManager, events } = this.ctx;

    return (command: Command): void => {
      if (cmdType === 'DRAG_MOVE') {
        handler(command);
        return;
      }

      if (cmdType === 'SELECT') {
        handler(command);
        const opts = (command as any).options ?? {};
        const mode = opts.mode ?? 'element';
        const selectedIds = Array.from(this.ctx.selectionState.selected).map(
          (e) => e.id,
        );
        events.emit('SVG_CAD_SELECT', {
          type: 'SVG_CAD_SELECT',
          mode,
          elementIds: selectedIds,
          diff: {},
        });
        return;
      }

      const ids = this.extractIds(command);
      const beforeSnapshots = new Map<string, Record<string, unknown>>();
      for (const id of ids) {
        const el = shapeManager.getById(id);
        if (el) beforeSnapshots.set(id, el.toSnapshot());
      }

      handler(command);

      if (timeMachine.suppressTimeMachine) return;

      if (EDIT_COMMANDS.has(cmdType)) {
        const fullSnapshotIds: string[] = [];
        const diffElements: AbstractGraphicElement[] = [];
        for (const id of ids) {
          const before = beforeSnapshots.get(id);
          const el = shapeManager.getById(id);
          if (!el) {
            if (before) fullSnapshotIds.push(id);
          } else {
            diffElements.push(el);
          }
        }
        timeMachine.push(
          cmdType as any,
          ids,
          'element',
          fullSnapshotIds,
          diffElements,
        );
      }

      if (cmdType === 'DELETE') {
        timeMachine.push('DELETE', ids, 'element', ids, []);
      }

      if (cmdType === 'CREATE' || cmdType === 'CREATE_FILE') {
        const newIds = this.extractIds(command);
        timeMachine.push(cmdType as any, newIds, 'element', newIds, []);
      }

      if (
        cmdType === 'GROUP_CREATE' ||
        cmdType === 'GROUP_DELETE' ||
        cmdType === 'GROUP_ADD' ||
        cmdType === 'GROUP_REMOVE' ||
        cmdType === 'GROUP_CLEAR'
      ) {
        timeMachine.push(cmdType as any, [], 'group', [], []);
      }
    };
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

  private registerElementCommands(): void {
    const {
      commandBus,
      selectionState,
      shapeManager,
      hitTestEngine,
      timeMachine,
      elementManager,
    } = this.ctx;

    commandBus.register(
      'SELECT',
      this.undoable(
        'SELECT',
        createSelectHandler({
          state: selectionState,
          getElements: () => shapeManager.getAll(),
          hitTestEngine,
          lookupGroup: (elementId) =>
            this.ctx.groupManager.getGroupByElement(elementId)?.id,
        }),
      ),
    );

    const dragCtx = {
      getElements: () => shapeManager.getAll(),
      onDragEnd: () => {},
    };
    commandBus.register('DRAG_MOVE', createDragMoveHandler(dragCtx));
    commandBus.register(
      'DRAG_END',
      this.undoable('DRAG_END', createDragEndHandler(dragCtx)),
    );

    commandBus.register(
      'DELETE',
      this.undoable('DELETE', createDeleteHandler(shapeManager, hitTestEngine)),
    );
    commandBus.register(
      'CREATE',
      this.undoable(
        'CREATE',
        createCreateHandler(shapeManager, (el) =>
          elementManager.indexShape(el),
        ),
      ),
    );
    commandBus.register(
      'BOOLEAN_OPERATION',
      this.undoable(
        'BOOLEAN_OPERATION',
        createBooleanOperationHandler(
          shapeManager,
          timeMachine,
          hitTestEngine,
          (el) => {
            el.onGeometryChanged = (element: AbstractGraphicElement) => {
              elementManager.reindexElement(element);
            };
          },
        ),
      ),
    );
  }

  private registerPathCommands(): void {
    const { commandBus, shapeManager } = this.ctx;

    const findPath = (id: string): PathElement | undefined => {
      const el = shapeManager.getAll().find((e) => e.id === id);
      return el instanceof PathElement ? el : undefined;
    };

    commandBus.register(
      'GEOMETRY_MUTATE',
      this.undoable('GEOMETRY_MUTATE', (command: Command) => {
        if (command.type !== 'GEOMETRY_MUTATE') return;
        const el = findPath(command.options.id);
        if (el) {
          el.geometry.commands = command.options.newCommands;
          el.rebuildHitArea();
        }
      }),
    );

    commandBus.register(
      'PATH_ADD_NODE',
      this.undoable('PATH_ADD_NODE', (command: Command) => {
        if (command.type !== 'PATH_ADD_NODE') return;
        const el = findPath(command.options.id);
        if (el) {
          el.addNodeAt(
            command.options.cmdIdx,
            command.options.x,
            command.options.y,
            command.options.t,
            command.options.prevEndX,
            command.options.prevEndY,
          );
          el.rebuildHitArea();
        }
      }),
    );

    commandBus.register(
      'PATH_CHANGE_NODE_TYPE',
      this.undoable('PATH_CHANGE_NODE_TYPE', (command: Command) => {
        if (command.type !== 'PATH_CHANGE_NODE_TYPE') return;
        const el = findPath(command.options.id);
        if (el) {
          el.changeNodeType(command.options.cmdIdx, command.options.newType);
          el.rebuildHitArea();
        }
      }),
    );

    commandBus.register(
      'PATH_REMOVE_NODE',
      this.undoable('PATH_REMOVE_NODE', (command: Command) => {
        if (command.type !== 'PATH_REMOVE_NODE') return;
        const el = findPath(command.options.id);
        if (el) {
          el.removeNodeAt(command.options.cmdIdx);
          el.rebuildHitArea();
        }
      }),
    );

    commandBus.register(
      'PATH_MOVE_SUBPATH',
      this.undoable('PATH_MOVE_SUBPATH', (command: Command) => {
        if (command.type !== 'PATH_MOVE_SUBPATH') return;
        const el = findPath(command.options.id);
        if (el) {
          el.translateSubpath(
            command.options.subpathIdx,
            command.options.delta.x,
            command.options.delta.y,
          );
          el.rebuildHitArea();
        }
      }),
    );
  }

  private registerTransformCommands(): void {
    const { commandBus, shapeManager } = this.ctx;

    commandBus.register(
      'ROTATE',
      this.undoable('ROTATE', (command: Command) => {
        if (command.type !== 'ROTATE') return;
        for (const id of command.options.elementIds) {
          const el = shapeManager.getAll().find((e) => e.id === id);
          if (el) {
            el.transform.rotate(command.options.angle, el.getLocalCenter());
            el.rebuildHitArea();
          }
        }
      }),
    );

    commandBus.register(
      'RESIZE',
      this.undoable('RESIZE', (command: Command) => {
        if (command.type !== 'RESIZE') return;
        const target = command.options.bbox;
        for (const id of command.options.elementIds) {
          const el = shapeManager.getAll().find((e) => e.id === id);
          if (!el) continue;
          const bbox = el.getTransformedBBox();
          if (bbox.width <= 0 || bbox.height <= 0) continue;
          const fx = target.width / bbox.width;
          const fy = target.height / bbox.height;
          if (fx <= 0 || fy <= 0) continue;
          const ox = bbox.x;
          const oy = bbox.y;
          const scaled = new DOMMatrix()
            .translateSelf(ox, oy)
            .scaleSelf(fx, fy)
            .translateSelf(-ox, -oy)
            .multiply(el.transform.matrix);
          el.transform.matrix = scaled;
          el.rebuildHitArea();
        }
      }),
    );

    commandBus.register(
      'TRANSFORM',
      this.undoable('TRANSFORM', (command: Command) => {
        if (command.type !== 'TRANSFORM') return;
        for (const id of command.options.elementIds) {
          const el = shapeManager.getAll().find((e) => e.id === id);
          if (el) {
            el.transform.matrix = new DOMMatrix(command.options.matrix);
            el.rebuildHitArea();
          }
        }
      }),
    );
  }

  private registerGroupCommands(): void {
    const { commandBus, shapeManager, groupManager, elementManager } = this.ctx;

    commandBus.register(
      'GROUP_CREATE',
      this.undoable('GROUP_CREATE', createGroupHandler(groupManager)),
    );
    commandBus.register(
      'GROUP_DELETE',
      this.undoable('GROUP_DELETE', createGroupHandler(groupManager)),
    );
    commandBus.register(
      'GROUP_ADD',
      this.undoable('GROUP_ADD', createGroupHandler(groupManager)),
    );
    commandBus.register(
      'GROUP_REMOVE',
      this.undoable('GROUP_REMOVE', createGroupHandler(groupManager)),
    );
    commandBus.register(
      'GROUP_CLEAR',
      this.undoable('GROUP_CLEAR', createGroupHandler(groupManager)),
    );
    commandBus.register(
      'CREATE_FILE',
      this.undoable(
        'CREATE_FILE',
        createCreateFileHandler(shapeManager, groupManager, (el) =>
          elementManager.indexShape(el),
        ),
      ),
    );
  }
}
