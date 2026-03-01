import {
  Canvas,
  type CanvasEvents,
  type FabricObject,
  type TEvent,
} from "fabric";

// Defines custom event listeners for history events
declare module "fabric" {
  interface CanvasEvents {
    "history:append": Partial<TEvent> & {
      /**
       * Serialized canvas state that was saved to history.
       */
      json: string;
      /**
       * Boolean flag indicating whether or not the appended history action is the initial state of the canvas.
       */
      initial: boolean;
    };
    "history:undo": Partial<TEvent> & {
      /**
       * Serialized canvas state that was most recently undone.
       */
      lastUndoAction: string;
    };
    "history:redo": Partial<TEvent> & {
      /**
       * Serialized canvas state that was most recently redone.
       */
      lastRedoAction: string;
    };
    "history:cleared": Partial<TEvent>;
  }
}

export class CanvasWithHistory extends Canvas {
  // History stack properties
  private _historyUndo: string[];
  private _historyRedo: string[];

  // Multi-selection properties
  private _selectedObjects: FabricObject[];
  private _isMultiSelection: boolean;

  // Boolean properties to determine whether or not we should save to history
  private _historyIsMoving: boolean;
  private _historyProcessing: boolean;

  private _historyCurrentState: string;

  constructor(...args: ConstructorParameters<typeof Canvas>) {
    super(...args);

    this._historyUndo = [];
    this._historyRedo = [];
    this._selectedObjects = [];
    this._isMultiSelection = false;
    this._historyIsMoving = false;
    this._historyProcessing = false;
    this._historyCurrentState = this._historyCurrent();

    this._bindEventListeners();
    this._historySaveInitialState();
  }

  /**
   * Binds all relevant fabric event listeners.
   */
  private _bindEventListeners() {
    this.on({
      "path:created": this._historySaveAction.bind(this),
      "erasing:end": this._historySaveAction.bind(this),
      "object:added": this._historySaveAction.bind(this),
      "object:removed": this._handleObjectRemoved.bind(this),
      "object:moving": this._handleObjectMoving.bind(this),
      "object:modified": this._handleObjectModified.bind(this),
      "selection:created": this._handleSelectionCreated.bind(this),
      "selection:updated": this._handleSelectionUpdated.bind(this),
      "selection:cleared": this._handleSelectionCleared.bind(this),
    });
  }

  /**
   * Stores the multi-selection state inside `_selectedObjects` and sets the `_isMultiSelection` flag to true.
   *
   * @param options - The options object containing the selected objects.
   */
  private _handleSelectionCreated(options: { selected: FabricObject[] }) {
    const currentSelectedObjects = options.selected;

    if (currentSelectedObjects.length > 1) {
      this._selectedObjects = currentSelectedObjects;
      this._isMultiSelection = true;
    }
  }

  /**
   * Stores the updated multi-selection state inside `_selectedObjects` and sets the `_isMultiSelection` flag to true if there are more than 1 objects selected.
   *
   * @param options - The options object containing the updated selected objects.
   */
  private _handleSelectionUpdated(options: { selected: FabricObject[] }) {
    const allSelectedObjects = this.getActiveObjects();
    this._selectedObjects = allSelectedObjects;
    this._isMultiSelection = allSelectedObjects.length > 1;
  }

  /**
   * Clears the multi-selection state and sets the `_isMultiSelection` flag to false.
   */
  private _handleSelectionCleared() {
    this._selectedObjects = [];
    this._isMultiSelection = false;
  }

  /**
   * Saves the initial state of the canvas.
   */
  private _historySaveInitialState() {
    const initialState = this._historyCurrent();
    this._historyUndo = [initialState];
    this._historyCurrentState = initialState;
  }

  /**
   * Handles object removal events.
   *
   * @param options - The options object containing details about the removed object.
   */
  private _handleObjectRemoved(options: { target: FabricObject }) {
    /*
     Check !_historyProcessing to prevent recursion: this.remove() fires
     object:removed events, which would re-enter this handler while we're
     still processing the first removal.
    */
    if (
      !this._historyProcessing &&
      this._isMultiSelection &&
      this._selectedObjects.some((obj) => obj === options.target)
    ) {
      this._historyProcessing = true;
      const objectsToRemove = [...this._selectedObjects];
      this._selectedObjects = [];
      this.remove(...objectsToRemove);
      this.discardActiveObject();
      this._historyProcessing = false;
      this._historySaveAction();
    } else {
      this._historySaveAction();
    }
  }
  /**
   * Starts the movement event listener for objects.
   */
  private _handleObjectMoving() {
    this._historyIsMoving = true;
  }

  /**
   * Handles object modification events, including moving, resizing, rotating,
   * scaling, and skewing.
   *
   * @see {@link https://fabricjs.com/api/type-aliases/ObjectModificationEvents/ | Fabric.js ObjectModificationEvents}
   */
  private _handleObjectModified() {
    // object:moving -> object:modified - modification is triggered as soon as the movement of an object halts
    this._historyIsMoving = false;
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
   * Records the current state of the canvas to the history stack if the state has changed since the last recorded state. This method is called after relevant canvas events such as object modifications, additions, and removals.
   */
  private _historySaveAction() {
    if (this._historyProcessing || this._historyIsMoving) return;
    const latestJSON = this._historyCurrent();

    if (this._historyCurrentState === latestJSON) return; // skips duplicates
    this._historyUndo.push(latestJSON);
    this._historyCurrentState = latestJSON;
    this._historyRedo = [];
    this.fire("history:append", { json: latestJSON, initial: false });
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
    this.fire("history:undo", { lastUndoAction: poppedState });
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
    this.fire("history:redo", { lastRedoAction: poppedState });
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
    try {
      this.clear();
      this.discardActiveObject();
      await this.loadFromJSON(JSON.parse(historyState));
      this.requestRenderAll();
    } catch (error) {
      console.error("Error loading from history:", error);
    } finally {
      this._historyProcessing = false;
    }
  }

  /**
   * Clears the history stacks for undo and redo.
   */
  clearHistory() {
    this._historySaveInitialState();
    this._historyRedo = [];
    this.fire("history:cleared");
  }

  /**
   * Debug method to log relevant events to the console. Always remember to remove before pushing once you're done debugging locally!
   */
  private _historyDebug() {
    const EVENTS = [
      "path:created",
      "erasing:end",
      "object:added",
      "object:removed",
      "object:moving",
      "object:modified",
      "selection:created",
      "selection:cleared",
      "canvas:cleared",
      "history:append",
      "history:undo",
      "history:redo",
      "history:cleared",
    ];

    EVENTS.forEach((e) => {
      this.on(e as keyof CanvasEvents, () =>
        console.log(`📝 Event triggered: ${e}`)
      );
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
      "object:removed": this._handleObjectRemoved.bind(this),
      "object:moving": this._handleObjectMoving.bind(this),
      "object:modified": this._handleObjectModified.bind(this),
      "selection:created": this._handleSelectionCreated.bind(this),
      "selection:updated": this._handleSelectionUpdated.bind(this),
      "selection:cleared": this._handleSelectionCleared.bind(this),
    });
  }

  /**
   * Cleans up event listeners and history stacks before disposing of the canvas instance.
   */
  dispose() {
    this._disposeEventListeners();
    this.clearHistory();
    return super.dispose();
  }

  /**
   * Clears the canvas and saves the cleared state to history.
   *
   * @remarks
   * When using `CanvasWithHistory`, use this method instead of `clear()`.
   * The inherited `clear()` method does not record to history.
   */
  clearCanvas() {
    this._historyProcessing = true;
    this.clear();
    this._historyProcessing = false;
    this._historySaveAction();
  }
}
