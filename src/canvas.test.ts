// @vitest-environment jsdom

import { Circle, Path, Rect } from "fabric";
import { beforeEach, describe, expect, test } from "vitest";
import { CanvasWithHistory } from "./canvas";

describe("canvas operations with history management", () => {
  let canvas: CanvasWithHistory;
  let circle: Circle;
  let path: Path;
  let rect: Rect;

  beforeEach(() => {
    const canvasEl = document.createElement("canvas");
    canvas = new CanvasWithHistory(canvasEl);

    circle = new Circle({
      radius: 20,
      fill: "green",
      left: 100,
      top: 100,
    });

    path = new Path("M 0 0 L 100 100 L 0 100 z", {
      fill: "",
      stroke: "red",
    });

    rect = new Rect({
      left: 100,
      top: 100,
      fill: "red",
      width: 50,
      height: 50,
    });
  });

  test("canvas only contains rect and circle after undo", async () => {
    canvas.add(rect);
    canvas.add(circle);
    canvas.add(path);

    await canvas.undo();

    // After undo: canvas should only contain rect and circle object
    expect(canvas.contains(path)).toBe(false);
  });

  test("canvas only contains circle after undo", async () => {
    canvas.add(circle);
    canvas.add(rect);
    canvas.add(path);

    await canvas.undo();
    await canvas.undo();

    // After undo: canvas should only contain circle object
    expect(canvas.contains(rect) && canvas.contains(path)).toBe(false);
  });

  test("canvas contains nothing after undo", async () => {
    canvas.add(path);

    await canvas.undo();

    // After undo: canvas should have 0 objects
    expect(canvas.contains(path)).toBe(false);
  });

  // Redo tests
  test("canvas contains path again after undo then redo", async () => {
    canvas.add(rect);
    canvas.add(circle);
    canvas.add(path);

    await canvas.undo();
    await canvas.redo();

    // After redo: canvas should contain all 3 objects again
    expect(canvas.getObjects().length).toBe(3);
  });

  test("canvas contains rect and path after two undos then one redo", async () => {
    canvas.add(rect);
    canvas.add(circle);
    canvas.add(path);

    await canvas.undo();
    await canvas.undo();
    await canvas.redo();

    // After 2 undos and 1 redo: canvas should contain rect and circle
    expect(canvas.getObjects().length).toBe(2);
  });

  test("canvas contains all objects after multiple undos then multiple redos", async () => {
    canvas.add(rect);
    canvas.add(circle);
    canvas.add(path);

    await canvas.undo();
    await canvas.undo();
    await canvas.undo();

    // After 3 undos: canvas should be empty
    expect(canvas.getObjects().length).toBe(0);

    await canvas.redo();
    await canvas.redo();
    await canvas.redo();

    // After 3 redos: canvas should contain all 3 objects
    expect(canvas.getObjects().length).toBe(3);
  });

  test("redo does nothing when there is nothing to redo", async () => {
    canvas.add(rect);
    canvas.add(circle);

    await canvas.redo();

    // Redo with no prior undo: canvas should still contain 2 objects
    expect(canvas.getObjects().length).toBe(2);
  });

  test("redo stack is cleared after new action", async () => {
    canvas.add(rect);
    canvas.add(circle);
    canvas.add(path);

    await canvas.undo();

    // Add a new object after undo (this should clear redo stack)
    const newRect = new Rect({
      left: 200,
      top: 200,
      fill: "blue",
      width: 30,
      height: 30,
    });
    canvas.add(newRect);

    // Try to redo - should do nothing since redo stack was cleared
    await canvas.redo();

    // Canvas should still have 3 objects (rect, circle, newRect) - path should not come back
    expect(canvas.getObjects().length).toBe(3);
    expect(canvas.canRedo()).toBe(false);
  });

  test("canUndo returns correct value", async () => {
    expect(canvas.canUndo()).toBe(false);

    canvas.add(rect);
    expect(canvas.canUndo()).toBe(true);

    await canvas.undo();
    expect(canvas.canUndo()).toBe(false);
  });

  test("canRedo returns correct value", async () => {
    canvas.add(rect);
    expect(canvas.canRedo()).toBe(false);

    await canvas.undo();
    expect(canvas.canRedo()).toBe(true);

    await canvas.redo();
    expect(canvas.canRedo()).toBe(false);
  });

  test("undo does nothing when there is nothing to undo", async () => {
    await canvas.undo();

    // Undo on empty canvas: should still be empty with no errors
    expect(canvas.getObjects().length).toBe(0);
  });
});
