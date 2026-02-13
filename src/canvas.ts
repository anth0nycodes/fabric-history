import { StaticCanvas } from "fabric";

export class CanvasWithHistory extends StaticCanvas {
  private _historyUndo: string[];
  private _historyRedo: string[];
  private _isMoving: boolean;
  private _historyProcessing: boolean;
  private _historyCurrentState: string;

  constructor(...args: ConstructorParameters<typeof StaticCanvas>) {
    super(...args);

    this._historyUndo = [];
    this._historyRedo = [];
    this._isMoving = false;
    this._historyProcessing = true;
    this._historyCurrentState = this._historyCurrentSnapshot();
    this._bindEventListeners();
  }

  /**
   * Binds all relevant fabric event listeners.
   */
  private _bindEventListeners() {
    this.on({
      "path:created": this._historySaveAction.bind(this),
      "erasing:end": this._historySaveAction.bind(this),
      "object:added": this._historySaveAction.bind(this),
      "object:removed": this._historySaveAction.bind(this),
      "object:moving": this._objectMoving.bind(this),
      "object:modified": this._handleObjectModified.bind(this),
      "canvas:cleared": this._historySaveAction.bind(this),
    });
  }

  /**
   * Unsubscribes all relevant fabric event listeners.
   */
  private _disposeEventListeners() {
    this.off({
      "path:created": this._historySaveAction.bind(this),
      "erasing:end": this._historySaveAction.bind(this),
      "object:added": this._historySaveAction.bind(this),
      "object:removed": this._historySaveAction.bind(this),
      "object:moving": this._objectMoving.bind(this),
      "object:modified": this._handleObjectModified.bind(this),
      "canvas:cleared": this._historySaveAction.bind(this),
    });
  }

  /**
   * Starts the movement event listener for objects.
   */
  private _objectMoving() {
    this._isMoving = true;
  }

  /**
   * Handles object modification events, including moving, resizing, rotating,
   * scaling, and skewing.
   *
   * @param {Object} e - The canvas event listener.
   * @see {@link https://fabricjs.com/api/type-aliases/ObjectModificationEvents/ | Fabric.js ObjectModificationEvents}
   */
  private _handleObjectModified(e: any) {
    // object:moving -> object:modified - modification is triggered as soon as the movement of an object halts
    this._isMoving = false;
    this._historySaveAction(e);
  }

  /**
   * Gets current snapshot of the canvas
   */
  private _historyCurrentSnapshot() {
    const snapshot = JSON.stringify(this.toDatalessJSON()); // lightweight serialization
    return snapshot;
  }

  /**
   * Records the current canvas, object, or path state into the history stack for undo/redo.
   * @param {Object} e - The canvas event listener.
   */
  private _historySaveAction(e: any) {
    if (this._historyProcessing || this._isMoving) return;
    const JSON = this._historyCurrentState;
  }

  /**
   * Undo the most recent action.
   */
  undo() {
    // Undo should pop the last item in the history array
    // We need to somehow keep track of the history by checking the additions being saved to the undo and redo arrays
  }

  /**
   * Checks for whether or not an action can be undone.
   */
  canUndo() {
    return this._historyUndo.length > 0;
  }

  dispose() {
    this._disposeEventListeners();
    return super.dispose();
  }
}
