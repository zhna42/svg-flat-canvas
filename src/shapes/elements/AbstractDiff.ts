type DiffData = Record<string, any>;
type SubscriptionCallback = (newValue: any, path: string) => void;

export abstract class AbstractDiff {
  [key: string]: any;
  private _historyDiff: DiffData = {};
  private _backendDiff: DiffData = {};
  private _renderDiff: DiffData = {};
  private _isApplyingDiff = false;
  private _listeners: Map<string, Set<SubscriptionCallback>> = new Map();

  constructor() { return this._wrapWithProxy(this, ''); }

  private _wrapWithProxy(obj: Record<string, any>, path: string): any {
    const self = this;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('_')) continue;
      const value = obj[key];
      if (value && typeof value === 'object' && !(value instanceof AbstractDiff)) {
        const nextPath = path ? `${path}.${key}` : key;
        obj[key] = this._wrapWithProxy(value, nextPath);
      }
    }
    return new Proxy(obj, {
      set(target, prop: string, value: any, receiver) {
        if (prop.startsWith('_')) return Reflect.set(target, prop, value, receiver);
        const oldValue = Reflect.get(target, prop, receiver);
        if (oldValue === value) return true;
        const currentPath = path ? `${path}.${prop}` : prop;
        if (!self._isApplyingDiff) { self._historyDiff[currentPath] = value; self._backendDiff[currentPath] = value; self._renderDiff[currentPath] = value; }
        if (value && typeof value === 'object' && !(value instanceof AbstractDiff)) value = self._wrapWithProxy(value, currentPath);
        const success = Reflect.set(target, prop, value, receiver);
        if (success) self._notifyListeners(currentPath, value);
        return success;
      },
    });
  }

  public subscribe(paths: string | string[], callback: SubscriptionCallback): () => void {
    const pathList = Array.isArray(paths) ? paths : [paths];
    for (const path of pathList) { if (!this._listeners.has(path)) this._listeners.set(path, new Set()); this._listeners.get(path)!.add(callback); }
    return () => { for (const path of pathList) { const s = this._listeners.get(path); if (s) { s.delete(callback); if (s.size === 0) this._listeners.delete(path); } } };
  }

  private _notifyListeners(path: string, newValue: any): void {
    const exact = this._listeners.get(path); if (exact) for (const cb of exact) cb(newValue, path);
    const parts = path.split('.');
    if (parts.length > 1) { let parentPath = ''; for (let i = 0; i < parts.length - 1; i++) { parentPath = parentPath ? `${parentPath}.${parts[i]}` : parts[i]; const pl = this._listeners.get(parentPath); if (pl) for (const cb of pl) cb(this[parentPath], parentPath); } }
  }

  public getHistoryDiff(): DiffData { return { ...this._historyDiff }; }
  public clearHistoryDiff(): void { this._historyDiff = {}; }
  public getBackendDiff(): DiffData { return { ...this._backendDiff }; }
  public clearBackendDiff(): void { this._backendDiff = {}; }
  public isSavedOnBackend(): boolean { return Object.keys(this._backendDiff).length === 0; }
  public getRenderDiff(): DiffData { return { ...this._renderDiff }; }
  public clearRenderDiff(): void { this._renderDiff = {}; }

  public setDiff(diff: DiffData, writeToDiffs: boolean = false): void {
    if (!writeToDiffs) this._isApplyingDiff = true;
    for (const [path, value] of Object.entries(diff)) { const keys = path.split('.'); let cur: Record<string, any> = this; for (let i = 0; i < keys.length - 1; i++) { const k = keys[i]; if (!cur[k]) cur[k] = {}; cur = cur[k]; } const lk = keys[keys.length - 1]; cur[lk] = value; this._notifyListeners(path, value); }
    this._isApplyingDiff = false;
  }

  public getFullData(): Record<string, any> {
    const result: Record<string, any> = {};
    const ser = (obj: Record<string, any>, path: string) => { for (const key of Object.keys(obj)) { if (key.startsWith('_') || typeof obj[key] === 'function') continue; const cp = path ? `${path}.${key}` : key; const v = obj[key]; if (v && typeof v === 'object') ser(v, cp); else result[cp] = v; } };
    ser(this, ''); return result;
  }
}
