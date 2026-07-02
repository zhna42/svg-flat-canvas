import { LayerName } from '@/types';

export type DiffValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | unknown[]
  | Record<string, unknown>;
export type DiffData = Record<string, DiffValue>;
export type SubscriptionCallback = (newValue: unknown, path: string) => void;

export abstract class ReactiveNode {
  [key: string]: any;

  public id = '';
  public type = '';
  public layerName: LayerName = 'shapesGroup';

  public pushDiffRendering: ((instance: this) => void) | null = null;
  public onTimeMachineChange: ((instance: this) => void) | null = null;
  public onSaveChange: ((instance: this) => void) | null = null;
  public isAutoReRendering = true;

  #diffRendering: DiffData = {};
  #diffTimeMachineNew: DiffData = {};
  #diffTimeMachineOld: DiffData = {};
  #diffSave: DiffData = {};

  #isApplyingDiff = false;
  #listeners: Map<string, Set<SubscriptionCallback>> = new Map();
  #proxyCache = new WeakMap<object, any>();

  constructor(id: string, type: string, layerName: LayerName) {
    this.id = id;
    this.type = type;
    this.layerName = layerName;
    return this._createRootProxy();
  }

  private static _isWrapSafe(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    if (value instanceof ReactiveNode) return false;
    if (value instanceof Node) return false;
    if (value instanceof DOMMatrix) return false;
    if (value instanceof DOMPoint) return false;
    return true;
  }

  private _isSystemKey(key: string): boolean {
    return (
      [
        'pushDiffRendering',
        'onTimeMachineChange',
        'onSaveChange',
        'isAutoReRendering',
        'renderingDiff',
        'timeMachineDiff',
        'saveDiff',
      ].includes(key) || key.startsWith('#')
    );
  }

  private _createRootProxy(): this {
    return this._wrapWithProxy(this, '') as this;
  }

  private _wrapWithProxy(obj: Record<string, unknown>, path: string): unknown {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    if (this.#proxyCache.has(obj)) {
      return this.#proxyCache.get(obj);
    }

    const proxy = new Proxy(obj, {
      get(target, prop: string, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (!self._isSystemKey(prop) && ReactiveNode._isWrapSafe(value)) {
          const currentPath = path ? `${path}.${prop}` : prop;
          return self._wrapWithProxy(
            value as Record<string, unknown>,
            currentPath,
          );
        }
        return value;
      },
      set(target, prop: string, value: unknown, receiver) {
        if (self._isSystemKey(prop)) {
          return Reflect.set(target, prop, value, receiver);
        }

        const oldValue = Reflect.get(target, prop, receiver) as DiffValue;
        if (oldValue === value) return true;

        const currentPath = path ? `${path}.${prop}` : prop;

        if (!self.#isApplyingDiff) {
          self.#diffRendering[currentPath] = value as DiffValue;
          if (!(currentPath in self.#diffTimeMachineOld)) {
            self.#diffTimeMachineOld[currentPath] = oldValue;
          }
          self.#diffTimeMachineNew[currentPath] = value as DiffValue;
          self.#diffSave[currentPath] = value as DiffValue;
        }

        const success = Reflect.set(target, prop, value, receiver);
        if (success) {
          self._notifyListeners(currentPath, value);
          if (self.isAutoReRendering && self.pushDiffRendering)
            self.pushDiffRendering(receiver);
          if (self.onTimeMachineChange) self.onTimeMachineChange(receiver);
          if (self.onSaveChange) self.onSaveChange(receiver);
        }
        return success;
      },
    });

    this.#proxyCache.set(obj, proxy);
    return proxy;
  }

  public get renderingDiff(): DiffData {
    return { ...this.#diffRendering };
  }
  public clearRenderingDiff(): void {
    this.#diffRendering = {};
  }

  public get timeMachineDiff(): { before: DiffData; after: DiffData } {
    return {
      before: { ...this.#diffTimeMachineOld },
      after: { ...this.#diffTimeMachineNew },
    };
  }
  public clearTimeMachineDiff(): void {
    this.#diffTimeMachineOld = {};
    this.#diffTimeMachineNew = {};
  }

  public get saveDiff(): DiffData {
    return { ...this.#diffSave };
  }
  public clearSaveDiff(): void {
    this.#diffSave = {};
  }

  public subscribe(
    paths: string | string[],
    callback: SubscriptionCallback,
  ): () => void {
    const pathList = Array.isArray(paths) ? paths : [paths];
    for (const path of pathList) {
      if (!this.#listeners.has(path)) this.#listeners.set(path, new Set());
      this.#listeners.get(path)!.add(callback);
    }
    return () => {
      for (const path of pathList) {
        const s = this.#listeners.get(path);
        if (s) {
          s.delete(callback);
          if (s.size === 0) this.#listeners.delete(path);
        }
      }
    };
  }

  private _notifyListeners(path: string, newValue: unknown): void {
    const exact = this.#listeners.get(path);
    if (exact) for (const cb of exact) cb(newValue, path);

    const parts = path.split('.');
    if (parts.length > 1) {
      let parentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        parentPath = parentPath ? `${parentPath}.${parts[i]}` : parts[i];
        const pl = this.#listeners.get(parentPath);
        if (pl) {
          const rootProxy = this.#proxyCache.get(this);
          const parentValue = this._getValueByPath(rootProxy, parentPath);
          for (const cb of pl) cb(parentValue, parentPath);
        }
      }
    }
  }

  private _getValueByPath(obj: any, path: string): unknown {
    return path
      .split('.')
      .reduce(
        (acc, c) => (acc && acc[c] !== undefined ? acc[c] : undefined),
        obj,
      );
  }

  public setDiff(diff: DiffData, writeToDiffs = false): void {
    const wasApplying = this.#isApplyingDiff;
    if (!writeToDiffs) this.#isApplyingDiff = true;
    try {
      const rootProxy = this.#proxyCache.get(this) || this;
      for (const [path, value] of Object.entries(diff)) {
        const keys = path.split('.');
        let cur = rootProxy as Record<string, unknown>;
        for (let i = 0; i < keys.length - 1; i++) {
          const k = keys[i];
          if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
          cur = cur[k] as Record<string, unknown>;
        }
        cur[keys[keys.length - 1]] = value;
      }
    } finally {
      this.#isApplyingDiff = wasApplying;
    }
  }

  public getFullData(): Record<string, DiffValue> {
    const result: Record<string, DiffValue> = {};
    const rootProxy = this.#proxyCache.get(this) || this;
    const ser = (obj: Record<string, unknown>, path: string) => {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'function' || this._isSystemKey(key)) continue;
        const cp = path ? `${path}.${key}` : key;
        const v = obj[key];
        if (
          v &&
          typeof v === 'object' &&
          !(v instanceof DOMMatrix) &&
          !(v instanceof DOMPoint)
        ) {
          ser(v as Record<string, unknown>, cp);
        } else {
          result[cp] = v as DiffValue;
        }
      }
    };
    ser(rootProxy as unknown as Record<string, unknown>, '');
    return result;
  }
}
