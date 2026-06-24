import type { PathCommand } from '@/types';
import type { Pt, BooleanOp } from './BooleanKernel';
import { booleanOperation } from './BooleanKernel';
import { flattenCommands } from '@/utils/path-utils';
import { commandsToString } from '@/utils/path-utils';

interface CachedElement {
  id: string;
  finePolygons: Pt[][];
  coarsePolygons: Pt[][];
  commands: PathCommand[];
}

export class BooleanEngine {
  private cache = new Map<string, CachedElement>();

  public cacheElement(id: string, commands: PathCommand[]): void {
    if (this.cache.has(id)) return;
    this.setCache(id, commands);
  }

  public updateCache(id: string, commands: PathCommand[]): void {
    this.setCache(id, commands);
  }

  private setCache(id: string, commands: PathCommand[]): void {
    const fine = this.commandsToPolygons(commands, 16);
    const coarse = this.commandsToPolygons(commands, 4);
    this.cache.set(id, {
      id,
      finePolygons: fine,
      coarsePolygons: coarse,
      commands: commands.slice(),
    });
  }

  public getFinePolygons(id: string): Pt[][] {
    return this.cache.get(id)?.finePolygons ?? [];
  }

  public getCoarsePolygons(id: string): Pt[][] {
    return this.cache.get(id)?.coarsePolygons ?? [];
  }

  public getCommands(id: string): PathCommand[] {
    return this.cache.get(id)?.commands ?? [];
  }

  public clear(): void {
    this.cache.clear();
  }

  public clearIds(ids: string[]): void {
    for (const id of ids) this.cache.delete(id);
  }

  public executePreview(
    subjectIds: string[],
    clipIds: string[],
    op: BooleanOp,
  ): PathCommand[] {
    const subjectCoarse: Pt[][] = [];
    for (const id of subjectIds) {
      subjectCoarse.push(...this.getCoarsePolygons(id));
    }
    const clipCoarse: Pt[][] = [];
    for (const id of clipIds) {
      clipCoarse.push(...this.getCoarsePolygons(id));
    }
    const result = booleanOperation(subjectCoarse, clipCoarse, op);
    if (result.length === 0) return [];
    return this.polygonsToCommands(result);
  }

  public executeFine(
    subjectIds: string[],
    clipIds: string[],
    op: BooleanOp,
  ): PathCommand[] {
    const subjectFine: Pt[][] = [];
    for (const id of subjectIds) {
      subjectFine.push(...this.getFinePolygons(id));
    }
    const clipFine: Pt[][] = [];
    for (const id of clipIds) {
      clipFine.push(...this.getFinePolygons(id));
    }
    const result = booleanOperation(subjectFine, clipFine, op);
    if (result.length === 0) return [];
    const commands = this.polygonsToCommands(result);
    for (const id of [subjectIds, clipIds].flat()) this.cache.delete(id);
    return commands;
  }

  private commandsToPolygons(
    commands: PathCommand[],
    steps: number,
  ): Pt[][] {
    const subPaths = this.splitSubPaths(commands);
    return subPaths
      .map((cmds) => flattenCommands(cmds, steps))
      .filter((pts) => pts.length >= 3);
  }

  private splitSubPaths(commands: PathCommand[]): PathCommand[][] {
    const result: PathCommand[][] = [];
    let current: PathCommand[] = [];
    for (const c of commands) {
      if (c.command === 'M' && current.length > 0) {
        result.push(current);
        current = [];
      }
      current.push(c);
    }
    if (current.length > 0) result.push(current);
    return result;
  }

  public polygonsToCommands(polygons: Pt[][]): PathCommand[] {
    const commands: PathCommand[] = [];
    for (const ring of polygons) {
      if (ring.length < 3) continue;
      commands.push({ command: 'M', args: [ring[0].x, ring[0].y] });
      for (let i = 1; i < ring.length; i++) {
        commands.push({ command: 'L', args: [ring[i].x, ring[i].y] });
      }
      commands.push({ command: 'Z', args: [] });
    }
    return commands;
  }

  public allCachedIds(): string[] {
    return Array.from(this.cache.keys());
  }
}

export function dString(commands: PathCommand[]): string {
  return commandsToString(commands);
}
