import { Canvas } from "fabric";

export class CanvasWithHistory extends Canvas {
  private _historyUndos: string[];
  private _historyRedos: string[];

  constructor(...args: ConstructorParameters<typeof Canvas>) {
    super(...args);

    this._historyUndos = [];
    this._historyRedos = [];

    this._observeHistoryEvents();
  }

  /**
   * Binds all relevant event listeners.
   */
  private _observeHistoryEvents() {
    this.on({
      "path:created": () => {},
      "erasing:end": () => {},
      "object:added": () => {},
      "object:removed": () => {},
      "object:modified": () => {},
      "canvas:cleared": () => {},
    });
  }

  /**
   * Removes all relevant event listeners.
   */
  private _disposeHistoryEvents() {
    this.off({
      "path:created": () => {},
      "erasing:end": () => {},
      "object:added": () => {},
      "object:removed": () => {},
      "object:modified": () => {},
      "canvas:cleared": () => {},
    });
  }

  /**
   * Checks if there are actions that can be undone.
   */
  canUndo() {
    return this._historyUndos.length > 0;
  }

  /**
   * Checks if there are actions that can be redone.
   */
  canRedo() {
    return this._historyRedos.length > 0;
  }

  /**
   * Cleans up history event listeners before disposal.
   */
  dispose() {
    this._disposeHistoryEvents();
    return super.dispose();
  }
}
