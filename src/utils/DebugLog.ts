export class DebugLog {
  private _enabled = false;

  public get enabled(): boolean {
    return this._enabled;
  }

  public setEnabled(v: boolean): void {
    this._enabled = v;
  }

  public log(category: string, message: string, data?: unknown): void {
    if (!this._enabled) return;
    const ts = new Date().toISOString().slice(11, 23);
    console.log(`[${ts}] [${category}] ${message}`, data ?? '');
  }

  public warn(category: string, message: string, data?: unknown): void {
    if (!this._enabled) return;
    const ts = new Date().toISOString().slice(11, 23);
    console.warn(`[${ts}] [${category}] ${message}`, data ?? '');
  }
}
