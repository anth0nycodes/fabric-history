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
    this._saveInitialState();
  }

  /**
   * Binds all relevant fabric event listeners.
   */
  private _bindEventListeners() {
    this.on({
      "path:created": this._historySaveAction.bind(this),
      "erasing:end": this._historySaveAction.bind(this),
      "object:added": this._historySaveAction.bind(this),
      "object:removed": this._historySaveAction.bind(this), // TODO: handle object modification + deletion batching
      "object:moving": this._objectMoving.bind(this),
      "object:modified": this._handleObjectModified.bind(this),
      "canvas:cleared": this._historySaveAction.bind(this),
    });
  }

  /**
   * Saves the initial state of the canvas.
   */
  private _saveInitialState() {
    const initialState = this._historyCurrent();
    this._historyUndo = [initialState];
    this._historyCurrentState = initialState;
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
   * Returns the current state of the canvas as a string.
   *
   * @see {@link https://fabricjs.com/docs/old-docs/fabric-intro-part-3/#serialization | Fabric.js Serialization} for why we use toDatalessJSON() instead of toJSON().
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

    if (this._historyCurrentState === latestJSON) return;
    this._historyUndo.push(latestJSON);
    this._historyCurrentState = latestJSON;
    this._historyRedo = [];
  }

  /**
   * Undo the most recent action.
   */
  async undo() {
    if (this._historyUndo.length <= 1) return;
    this._historyProcessing = true;

    const poppedState = this._historyUndo.pop();
    if (!poppedState) return;

    this._historyRedo.push(poppedState);

    // refresh canvas to load what remains on the undo stack after popping
    const previousState = this._historyUndo[this._historyUndo.length - 1];
    if (!previousState) return;
    this._historyCurrentState = previousState;
    await this._loadFromHistory(previousState);
  }

  /**
   * Checks for whether or not an action can be undone.
   */
  canUndo() {
    return this._historyUndo.length > 1;
  }

  /**
   * Redo the most recently undone action.
   */
  async redo() {
    if (this._historyRedo.length === 0) return;
    this._historyProcessing = true;

    const poppedState = this._historyRedo.pop();
    if (!poppedState) return;

    this._historyUndo.push(poppedState);

    // refresh canvas to load the popped state
    this._historyCurrentState = poppedState;
    await this._loadFromHistory(poppedState);
  }

  /**
   * Checks for whether or not an action can be redone.
   */
  canRedo() {
    return this._historyRedo.length > 0;
  }

  /**
   * Loads a canvas history state from the history stack and renders it on the canvas.
   *
   * @param historyState - The JSON string representing the canvas history state to load.
   */
  private async _loadFromHistory(historyState: string) {
    this.clear();
    this.discardActiveObject();

    try {
      const parsed = JSON.parse(historyState);
      await this.loadFromJSON(parsed);
      this.renderAll();
    } catch (error) {
      console.error("Error loading from history:", error);
    } finally {
      this._historyProcessing = false;
    }
  }

  /**
   * Clears the history stacks for undo and redo.
   */
  private _clearHistory() {
    this._historyUndo = [];
    this._historyRedo = [];
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
    this._clearHistory();
    return super.dispose();
  }
}
