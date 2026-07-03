import { LayerName } from '@/types';
import type { DiffData, DiffValue, SubscriptionCallback } from '@/types';

export abstract class ReactiveNode {
  [key: string]: any;

  public id = '';
  public type = '';
  public layerName: LayerName = 'shapesGroup';

  public pushDiffRendering: ((instance: any) => void) | null = null;
  public onTimeMachineChange: ((instance: any) => void) | null = null;
  public onSaveChange: ((instance: any) => void) | null = null;
  public isAutoReRendering = true;

  _diffRendering: DiffData = {};
  _diffTimeMachineNew: DiffData = {};
  _diffTimeMachineOld: DiffData = {};
  _diffSave: DiffData = {};

  _isApplyingDiff = false;
  _listeners: Map<string, Set<SubscriptionCallback>> = new Map();
  _proxyCache = new WeakMap<object, any>();
  _rootProxy: this;

  constructor(id: string, type: string, layerName: LayerName) {
    this.id = id;
    this.type = type;
    this.layerName = layerName;
    this._rootProxy = this._createRootProxy();
    return this._rootProxy;
  }

  private static _isWrapSafe(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    if (value instanceof ReactiveNode) return false;
    if (value instanceof Node) return false;
    if (value instanceof DOMMatrix) return false;
    if (value instanceof DOMPoint) return false;
    return true;
  }

  private _isSystemKey(key: string | symbol): boolean {
    if (typeof key !== 'string') return true;
    return (
      new Set([
        'pushDiffRendering',
        'onTimeMachineChange',
        'onSaveChange',
        'isAutoReRendering',
        'renderingDiff',
        'timeMachineDiff',
        'saveDiff',
        'clearRenderingDiff',
        'clearTimeMachineDiff',
        'clearSaveDiff',
        'getRenderingPayload',
        'getFullData',
        'setDiff',
        'subscribe',
      ]).has(key) ||
      key.startsWith('_')
    );
  }

  private _createRootProxy(): this {
    return this._wrapWithProxy(this, '') as this;
  }

  private _findGetterDescriptor(
    obj: Record<string, unknown>,
    prop: string,
  ): PropertyDescriptor | undefined {
    let proto: object | null = obj;
    while (proto) {
      const d = Object.getOwnPropertyDescriptor(proto, prop);
      if (d && d.get) return d;
      proto = Object.getPrototypeOf(proto);
    }
    return undefined;
  }

  private _wrapWithProxy(obj: Record<string, unknown>, path: string): unknown {
    const self = this;

    if (this._proxyCache.has(obj)) {
      return this._proxyCache.get(obj);
    }

    const proxy = new Proxy(obj, {
      get(target: Record<string, unknown>, prop: string, receiver: unknown) {
        const getterDesc = self._findGetterDescriptor(target, prop);
        if (getterDesc?.get) {
          const value = getterDesc.get.call(target);
          if (!self._isSystemKey(prop) && ReactiveNode._isWrapSafe(value)) {
            const currentPath = path ? `${path}.${prop}` : prop;
            return self._wrapWithProxy(
              value as Record<string, unknown>,
              currentPath,
            );
          }
          return value;
        }

        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function' && !self._isSystemKey(prop)) {
          return value.bind(receiver);
        }
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

        if (!self._isApplyingDiff) {
          self._diffRendering[currentPath] = value as DiffValue;
          if (!(currentPath in self._diffTimeMachineOld)) {
            self._diffTimeMachineOld[currentPath] = oldValue;
          }
          self._diffTimeMachineNew[currentPath] = value as DiffValue;
          self._diffSave[currentPath] = value as DiffValue;
        }

        const success = Reflect.set(target, prop, value, receiver);
        if (success) {
          self._notifyListeners(currentPath, value);
          if (self.isAutoReRendering && self.pushDiffRendering) {
            console.log(`[ReactiveNode] set ${currentPath}:`, oldValue, '→', value);
            self.pushDiffRendering(self._rootProxy);
          }
          if (self.onTimeMachineChange) self.onTimeMachineChange(self._rootProxy);
          if (self.onSaveChange) self.onSaveChange(self._rootProxy);
        }
        return success;
      },
    });

    this._proxyCache.set(obj, proxy);
    this._proxyCache.set(proxy, proxy);
    return proxy;
  }

  public get renderingDiff(): DiffData {
    return { ...this._diffRendering };
  }
  public clearRenderingDiff(): void {
    this._diffRendering = {};
  }

  public get timeMachineDiff(): { before: DiffData; after: DiffData } {
    return {
      before: { ...this._diffTimeMachineOld },
      after: { ...this._diffTimeMachineNew },
    };
  }
  public clearTimeMachineDiff(): void {
    this._diffTimeMachineOld = {};
    this._diffTimeMachineNew = {};
  }

  public get saveDiff(): DiffData {
    return { ...this._diffSave };
  }
  public clearSaveDiff(): void {
    this._diffSave = {};
  }

  public subscribe(
    paths: string | string[],
    callback: SubscriptionCallback,
  ): () => void {
    const pathList = Array.isArray(paths) ? paths : [paths];
    for (const path of pathList) {
      if (!this._listeners.has(path)) this._listeners.set(path, new Set());
      this._listeners.get(path)!.add(callback);
    }
    return () => {
      for (const path of pathList) {
        const s = this._listeners.get(path);
        if (s) {
          s.delete(callback);
          if (s.size === 0) this._listeners.delete(path);
        }
      }
    };
  }

  private _notifyListeners(path: string, newValue: unknown): void {
    const exact = this._listeners.get(path);
    if (exact) for (const cb of exact) cb(newValue, path);

    const parts = path.split('.');
    if (parts.length > 1) {
      let parentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        parentPath = parentPath ? `${parentPath}.${parts[i]}` : parts[i];
        const pl = this._listeners.get(parentPath);
        if (pl) {
          const parentValue = this._getValueByPath(this._rootProxy, parentPath);
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
    const wasApplying = this._isApplyingDiff;
    if (!writeToDiffs) this._isApplyingDiff = true;
    try {
      for (const [path, value] of Object.entries(diff)) {
        const keys = path.split('.');
        let cur = this._rootProxy as unknown as Record<string, unknown>;
        for (let i = 0; i < keys.length - 1; i++) {
          const k = keys[i];
          if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
          cur = cur[k] as Record<string, unknown>;
        }
        cur[keys[keys.length - 1]] = value;
      }
    } finally {
      this._isApplyingDiff = wasApplying;
    }
  }

  public getRenderingPayload(): Record<string, unknown> {
    return { ...this.renderingDiff };
  }

  public getFullData(): Record<string, DiffValue> {
    const result: Record<string, DiffValue> = {};
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
    ser(this._rootProxy as unknown as Record<string, unknown>, '');
    return result;
  }
}
