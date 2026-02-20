import { Canvas } from "fabric";

export class CanvasWithHistory extends Canvas {
  // History stacks
  private _historyUndo: string[];
  private _historyRedo: string[];

  // Boolean values to determine whether or not we should save to history
  private _isMoving: boolean;
  private _historyProcessing: boolean;

  private _historyCurrentState: string;

  constructor(...args: ConstructorParameters<typeof Canvas>) {
    super(...args);

    this._historyUndo = [];
    this._historyRedo = [];
    this._isMoving = false;
    this._historyProcessing = false;
    this._historyCurrentState = this._historyCurrent();
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
   * Starts the movement event listener for objects.
   */
  private _objectMoving() {
    this._isMoving = true;
  }

  /**
   * Handles object modification events, including moving, resizing, rotating,
   * scaling, and skewing.
   *
   * @see {@link https://fabricjs.com/api/type-aliases/ObjectModificationEvents/ | Fabric.js ObjectModificationEvents}
   */
  private _handleObjectModified() {
    // object:moving -> object:modified - modification is triggered as soon as the movement of an object halts
    this._isMoving = false;
    this._historySaveAction();
  }

  /**
   * Returns the current state of the canvas as a string
   * @see {@link https://fabricjs.com/docs/old-docs/fabric-intro-part-3/#serialization | Fabric.js Serialization} for why we use toDatalessJSON() instead of toJSON()
   */
  private _historyCurrent() {
    return JSON.stringify(this.toDatalessJSON());
  }

  /**
   * Records the current canvas, object, or path state into the history stack for undo/redo.
   */
  private _historySaveAction() {
    if (this._historyProcessing || this._isMoving) return;
    const latestJSON = this._historyCurrent();

    if (this._historyCurrentState === latestJSON) return; // Skips saving if the current history state equals the latest history state
    this._historyUndo.push(latestJSON);
    this._historyCurrentState = latestJSON; // updates the current history state to the latest state after saving to the undo stack
    this._historyRedo = [];
  }

  /**
   * Undo the most recent action.
   */
  undo() {
    if (this._historyUndo.length === 0) return;

    const poppedState = this._historyUndo.pop();
    if (!poppedState) return;

    this._historyRedo.push(poppedState);

    // refresh canvas to load previous state
    const previousState = this._historyUndo[this._historyUndo.length - 1];
    this._historyCurrentState = previousState;
    this._loadFromHistory(previousState);
  }

  /**
   * Loads a previous canvas state from the history stack and renders it on the canvas.
   *
   * @param historyState - The JSON string representing the previous canvas state to load.
   */
  private _loadFromHistory(historyState: string) {
    const history = JSON.parse(historyState);

    // TODO: finish up history loading logic
    this.loadFromJSON(history, () => {
      this.renderAll();
    });
  }

  /**
   * Checks for whether or not an action can be undone.
   */
  canUndo() {
    return this._historyUndo.length > 0;
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

  dispose() {
    this._disposeEventListeners();
    return super.dispose();
  }
}
