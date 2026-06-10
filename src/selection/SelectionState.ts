import type { SvgElement } from '@/shapes/elements/SvgElement';
import type { SelectionMode } from './SelectionMode';
import type { SelectionFilter } from './selection-filter';

export class SelectionState {
  private _selected: SvgElement[] = [];
  private _mode: SelectionMode = 'element';
  private _filter: SelectionFilter | null = null;
  private _onChange: ((selected: SvgElement[]) => void) | null = null;
  private _onModeChange: ((mode: SelectionMode) => void) | null = null;

  public get selected(): readonly SvgElement[] {
    return this._selected;
  }

  public get mode(): SelectionMode {
    return this._mode;
  }

  public setMode(mode: SelectionMode): void {
    if (this._mode === mode) return;
    this._mode = mode;
    this._onModeChange?.(mode);
  }

  public setFilter(fn: SelectionFilter | null): void {
    this._filter = fn;
  }

  public setOnChange(fn: ((selected: SvgElement[]) => void) | null): void {
    this._onChange = fn;
  }

  public setOnModeChange(fn: ((mode: SelectionMode) => void) | null): void {
    this._onModeChange = fn;
  }

  public add(elements: SvgElement[]): void {
    const filtered = this._filter ? this._filter(elements) : elements;
    const existing = new Set(this._selected.map((e) => e.id));
    for (const el of filtered) {
      if (!existing.has(el.id)) {
        this._selected.push(el);
      }
    }
    this._onChange?.(this._selected);
  }

  public remove(elements: SvgElement[]): void {
    const ids = new Set(elements.map((e) => e.id));
    this._selected = this._selected.filter((e) => !ids.has(e.id));
    this._onChange?.(this._selected);
  }

  public toggle(elements: SvgElement[]): void {
    const filtered = this._filter ? this._filter(elements) : elements;
    const ids = new Set(this._selected.map((e) => e.id));
    const toRemove: SvgElement[] = [];
    const toAdd: SvgElement[] = [];

    for (const el of filtered) {
      if (ids.has(el.id)) {
        toRemove.push(el);
      } else {
        toAdd.push(el);
      }
    }

    if (toRemove.length > 0) {
      const removeIds = new Set(toRemove.map((e) => e.id));
      this._selected = this._selected.filter((e) => !removeIds.has(e.id));
    }
    this._selected.push(...toAdd);
    this._onChange?.(this._selected);
  }

  public replace(elements: SvgElement[]): void {
    const filtered = this._filter ? this._filter(elements) : elements;
    this._selected = [...filtered];
    this._onChange?.(this._selected);
  }

  public clear(): void {
    if (this._selected.length === 0) return;
    this._selected = [];
    this._onChange?.(this._selected);
  }
}
