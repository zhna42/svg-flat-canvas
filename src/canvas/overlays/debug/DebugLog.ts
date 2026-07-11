export class DebugLog {
  private _enabled = false;

  public get enabled(): boolean {
    return this._enabled;
  }

  public setEnabled(v: boolean): void {
    this._enabled = v;
  }

  public log(_category: string, _message: string, _data?: unknown): void {}

  public warn(_category: string, _message: string, _data?: unknown): void {}
}
