import { Rect, IText, type CanvasEvents, type FabricObject } from "fabric";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { CanvasWithHistory } from "../../src/canvas.js";

describe("excludeFromExport skips history", () => {
  let canvasEl: HTMLCanvasElement;
  let canvas: CanvasWithHistory;
  let events: string[];

  beforeEach(() => {
    canvasEl = document.createElement("canvas");
    canvasEl.id = "test-canvas";
    canvasEl.width = 800;
    canvasEl.height = 600;
    document.body.appendChild(canvasEl);

    events = [];
    canvas = new CanvasWithHistory(canvasEl, {
      width: 800,
      height: 600,
    });

    const eventsToTrack = [
      "object:added",
      "object:removed",
      "object:modified",
      "history:append",
    ];

    eventsToTrack.forEach((eventName) => {
      canvas.on(
        eventName as keyof CanvasEvents,
        (options: { target: FabricObject }) => {
          const targetType = options?.target?.type || "unknown";
          events.push(`${eventName} (${targetType})`);
        }
      );
    });
  });

  afterEach(() => {
    canvas.dispose();
    document.body.removeChild(canvasEl);
  });

  test("empty text with excludeFromExport does not append to history", () => {
    const text1 = new IText("Hello", { left: 50, top: 50 });
    const text2 = new IText("World", { left: 150, top: 50 });

    canvas.add(text1);
    canvas.add(text2);

    // Simulate an empty text that the consumer marks as excluded
    const emptyText = new IText("", { left: 250, top: 50 });
    if (emptyText.text === "") {
      emptyText.set("excludeFromExport", true);
    }
    canvas.add(emptyText);

    // All 3 objects are on the canvas
    expect(canvas.getObjects().length).toBe(3);

    // But only 2 history entries were recorded (emptyText was skipped)
    const historyAppends = events.filter((e) => e.includes("history:append"));
    expect(historyAppends.length).toBe(2);
  });

  test("excludeFromExport object removal does not append to history", () => {
    const rect = new Rect({ left: 50, top: 50, width: 50, height: 50 });
    canvas.add(rect);

    const excluded = new Rect({
      left: 150,
      top: 50,
      width: 50,
      height: 50,
      excludeFromExport: true,
    });
    canvas.add(excluded);

    events.length = 0;

    canvas.remove(excluded);

    const historyAppends = events.filter((e) => e.includes("history:append"));
    expect(historyAppends.length).toBe(0);
  });

  test("undo skips over excludeFromExport and restores the previous tracked state", async () => {
    const text1 = new IText("Hello", { left: 50, top: 50 });
    const text2 = new IText("World", { left: 150, top: 50 });

    canvas.add(text1);
    canvas.add(text2);

    // Add excluded empty text — no history entry created
    const emptyText = new IText("", { left: 250, top: 50 });
    emptyText.set("excludeFromExport", true);
    canvas.add(emptyText);

    // 2 history entries: text1 add, text2 add
    expect(canvas.canUndo()).toBe(true);

    // First undo reverts the text2 add (the last tracked action)
    await canvas.undo();
    expect(canvas.canUndo()).toBe(true);
    expect(canvas.canRedo()).toBe(true);

    // Second undo reverts the text1 add
    await canvas.undo();
    expect(canvas.canUndo()).toBe(false);
    expect(canvas.canRedo()).toBe(true);

    // No more undos — only the excluded add happened, and it wasn't tracked
    await canvas.undo();
    expect(canvas.canUndo()).toBe(false);
  });

  test("redo restores the correct state after undoing past an excludeFromExport add", async () => {
    const text1 = new IText("Hello", { left: 50, top: 50 });
    const text2 = new IText("World", { left: 150, top: 50 });

    canvas.add(text1);
    canvas.add(text2);

    const emptyText = new IText("", { left: 250, top: 50 });
    emptyText.set("excludeFromExport", true);
    canvas.add(emptyText);

    await canvas.undo();
    expect(canvas.canRedo()).toBe(true);

    await canvas.redo();
    // After redo we're back at the last tracked state (text1 + text2)
    // No further redo since the excluded add was never on the redo stack
    expect(canvas.canRedo()).toBe(false);
  });

  test("canUndo is not affected by excludeFromExport adds", () => {
    expect(canvas.canUndo()).toBe(false);

    // Adding an excluded object should not make canUndo true
    const excluded = new Rect({
      left: 50,
      top: 50,
      width: 50,
      height: 50,
      excludeFromExport: true,
    });
    canvas.add(excluded);
    expect(canvas.canUndo()).toBe(false);

    // Adding a normal object should make canUndo true
    const rect = new Rect({ left: 150, top: 50, width: 50, height: 50 });
    canvas.add(rect);
    expect(canvas.canUndo()).toBe(true);
  });

  test("canRedo is not affected by excludeFromExport adds", async () => {
    const rect = new Rect({ left: 50, top: 50, width: 50, height: 50 });
    canvas.add(rect);

    const excluded = new Rect({
      left: 150,
      top: 50,
      width: 50,
      height: 50,
      excludeFromExport: true,
    });
    canvas.add(excluded);

    expect(canvas.canRedo()).toBe(false);

    await canvas.undo();
    expect(canvas.canRedo()).toBe(true);

    await canvas.redo();
    expect(canvas.canRedo()).toBe(false);
  });

  test("multiple undo/redo cycles work correctly with excludeFromExport objects interleaved", async () => {
    const rect1 = new Rect({ left: 50, top: 50, width: 50, height: 50 });
    canvas.add(rect1);

    const excluded1 = new Rect({
      left: 100, top: 50, width: 50, height: 50,
      excludeFromExport: true,
    });
    canvas.add(excluded1);

    const rect2 = new Rect({ left: 200, top: 50, width: 50, height: 50 });
    canvas.add(rect2);

    const excluded2 = new Rect({
      left: 300, top: 50, width: 50, height: 50,
      excludeFromExport: true,
    });
    canvas.add(excluded2);

    // Only 2 history entries (rect1, rect2)
    const historyAppends = events.filter((e) => e.includes("history:append"));
    expect(historyAppends.length).toBe(2);

    // Undo rect2 add
    await canvas.undo();
    expect(canvas.canUndo()).toBe(true);
    expect(canvas.canRedo()).toBe(true);

    // Undo rect1 add
    await canvas.undo();
    expect(canvas.canUndo()).toBe(false);
    expect(canvas.canRedo()).toBe(true);

    // Redo rect1 add
    await canvas.redo();
    expect(canvas.canUndo()).toBe(true);
    expect(canvas.canRedo()).toBe(true);

    // Redo rect2 add
    await canvas.redo();
    expect(canvas.canUndo()).toBe(true);
    expect(canvas.canRedo()).toBe(false);
  });
});
