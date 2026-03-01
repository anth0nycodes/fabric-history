import { ActiveSelection, Circle, Rect, type CanvasEvents } from "fabric";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { CanvasWithHistory } from "../../src/canvas.js";

describe("ActiveSelection events", () => {
  let canvasEl: HTMLCanvasElement;
  let rect: Rect;
  let circle: Circle;
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
      "path:created",
      "erasing:end",
      "object:added",
      "object:removed",
      "object:modified",
      "object:moving",
      "selection:created",
      "selection:updated",
      "selection:cleared",
      "canvas:cleared",
      "history:append",
    ];

    eventsToTrack.forEach((eventName) => {
      canvas.on(eventName as keyof CanvasEvents, (e: any) => {
        const targetType = e?.target?.type || "unknown";
        events.push(`${eventName} (${targetType})`);
        console.log(`EVENT: ${eventName} (target: ${targetType})`);
      });
    });

    rect = new Rect({
      left: 100,
      top: 100,
      width: 80,
      height: 60,
      fill: "red",
    });

    circle = new Circle({
      left: 250,
      top: 100,
      radius: 40,
      fill: "blue",
    });
  });

  test("explore: what events fire when dragging an ActiveSelection", async () => {
    canvas.add(rect);
    canvas.add(circle);
    canvas.renderAll();

    console.log("--- Objects added, now selecting both ---");
    events.length = 0; // Clear events from adding

    // Get the upper canvas that Fabric creates (it handles all pointer events)
    const wrapper = canvasEl.parentElement!;
    const upperCanvas = wrapper.querySelector(
      ".upper-canvas"
    ) as HTMLCanvasElement;
    const canvasLocator = page.elementLocator(upperCanvas);

    // Select both objects by shift-clicking
    // First click on rect (position relative to element)
    await canvasLocator.click({ position: { x: 140, y: 130 } });

    // Shift+click on circle to add to selection
    await userEvent.keyboard("{Shift>}");
    await canvasLocator.click({ position: { x: 290, y: 140 } });
    await userEvent.keyboard("{/Shift}");

    console.log("--- Selection events:", events);
    events.length = 0;

    console.log("--- Now dragging the selection ---");

    // Drag the selection using mouse events on the canvas
    // Start position and end position relative to canvas
    const startX = 200;
    const startY = 130;
    const endX = 300;
    const endY = 180;

    // Simulate drag by dispatching mouse events directly to upperCanvas
    // (Fabric.js handles all pointer events on the upper canvas layer)
    const mouseDown = new MouseEvent("mousedown", {
      clientX: upperCanvas.getBoundingClientRect().left + startX,
      clientY: upperCanvas.getBoundingClientRect().top + startY,
      bubbles: true, // bubble so Fabric can catch it
    });
    upperCanvas.dispatchEvent(mouseDown);

    // Simulate movement in steps
    for (let i = 1; i <= 5; i++) {
      const currentX =
        upperCanvas.getBoundingClientRect().left +
        startX +
        ((endX - startX) * i) / 5;
      const currentY =
        upperCanvas.getBoundingClientRect().top +
        startY +
        ((endY - startY) * i) / 5;
      const mouseMove = new MouseEvent("mousemove", {
        clientX: currentX,
        clientY: currentY,
        bubbles: true, // bubble so Fabric can catch it
      });
      upperCanvas.dispatchEvent(mouseMove);
    }

    const mouseUp = new MouseEvent("mouseup", {
      clientX: upperCanvas.getBoundingClientRect().left + endX,
      clientY: upperCanvas.getBoundingClientRect().top + endY,
      bubbles: true, // bubble so Fabric can catch it
    });
    upperCanvas.dispatchEvent(mouseUp);

    console.log("--- Drag events:", events);

    // Log summary
    const modifiedEvents = events.filter((e) => e.includes("object:modified"));
    const movingEvents = events.filter((e) => e.includes("object:moving"));

    console.log(`\n=== SUMMARY ===`);
    console.log(`object:moving fired ${movingEvents.length} times`);
    console.log(`object:modified fired ${modifiedEvents.length} times`);
    console.log(`Modified event targets: ${modifiedEvents.join(", ")}`);

    expect(true).toBe(true);
  });

  test("explore: what events fire when deleting an ActiveSelection", async () => {
    canvas.add(rect);
    canvas.add(circle);
    canvas.renderAll();

    console.log("--- Objects added, now selecting both ---");
    events.length = 0; // Clear events from adding

    // Get the upper canvas that Fabric creates (it handles all pointer events)
    const wrapper = canvasEl.parentElement!;
    const upperCanvas = wrapper.querySelector(
      ".upper-canvas"
    ) as HTMLCanvasElement;
    const canvasLocator = page.elementLocator(upperCanvas);

    // Select both objects by shift-clicking
    // First click on rect (position relative to element)
    await canvasLocator.click({ position: { x: 140, y: 130 } });

    // Shift+click on circle to add to selection
    await userEvent.keyboard("{Shift>}");
    await canvasLocator.click({ position: { x: 290, y: 140 } });
    await userEvent.keyboard("{/Shift}");

    console.log("--- Selection events:", events);
    events.length = 0;

    console.log("--- Now deleting the selection ---");
    // Get the active selection and remove the individual objects inside it
    const activeObject = canvas.getActiveObject();
    if (activeObject instanceof ActiveSelection) {
      const objectsToRemove = activeObject.getObjects();
      canvas.remove(...objectsToRemove);
      canvas.discardActiveObject();
      canvas.renderAll();
    }

    console.log("--- Delete events:", events);

    // Log summary
    const removedEvents = events.filter((e) => e.includes("object:removed"));
    const historyAppendEvents = events.filter((e) =>
      e.includes("history:append")
    );
    const selectionClearedEvents = events.filter((e) =>
      e.includes("selection:cleared")
    );

    console.log(`\n=== SUMMARY ===`);
    console.log(`object:removed fired ${removedEvents.length} times`);
    console.log(`history:append fired ${historyAppendEvents.length} times`);
    console.log(
      `selection:cleared fired ${selectionClearedEvents.length} times`
    );

    // Key assertion: 2 removals but only 1 history entry (batched)
    expect(removedEvents.length).toBe(2);
    expect(historyAppendEvents.length).toBe(1);
    expect(canvas.getObjects().length).toBe(0);
  });

  test("undo restores all objects after deleting ActiveSelection", async () => {
    canvas.add(rect);
    canvas.add(circle);
    canvas.renderAll();

    // Get the upper canvas and select both objects
    const wrapper = canvasEl.parentElement!;
    const upperCanvas = wrapper.querySelector(
      ".upper-canvas"
    ) as HTMLCanvasElement;
    const canvasLocator = page.elementLocator(upperCanvas);

    await canvasLocator.click({ position: { x: 140, y: 130 } });
    await userEvent.keyboard("{Shift>}");
    await canvasLocator.click({ position: { x: 290, y: 140 } });
    await userEvent.keyboard("{/Shift}");

    // Delete the selection
    const activeObject = canvas.getActiveObject();
    if (activeObject instanceof ActiveSelection) {
      const objectsToRemove = activeObject.getObjects();
      canvas.remove(...objectsToRemove);
      canvas.discardActiveObject();
      canvas.renderAll();
    }

    expect(canvas.getObjects().length).toBe(0);

    // Undo should restore both objects
    await canvas.undo();

    expect(canvas.getObjects().length).toBe(2);
  });

  test("undo then redo after deleting ActiveSelection", async () => {
    canvas.add(rect);
    canvas.add(circle);
    canvas.renderAll();

    // Get the upper canvas and select both objects
    const wrapper = canvasEl.parentElement!;
    const upperCanvas = wrapper.querySelector(
      ".upper-canvas"
    ) as HTMLCanvasElement;
    const canvasLocator = page.elementLocator(upperCanvas);

    await canvasLocator.click({ position: { x: 140, y: 130 } });
    await userEvent.keyboard("{Shift>}");
    await canvasLocator.click({ position: { x: 290, y: 140 } });
    await userEvent.keyboard("{/Shift}");

    // Delete the selection
    const activeObject = canvas.getActiveObject();
    if (activeObject instanceof ActiveSelection) {
      const objectsToRemove = activeObject.getObjects();
      canvas.remove(...objectsToRemove);
      canvas.discardActiveObject();
      canvas.renderAll();
    }

    expect(canvas.getObjects().length).toBe(0);

    // Undo restores objects
    await canvas.undo();
    expect(canvas.getObjects().length).toBe(2);

    // Redo removes them again
    await canvas.redo();
    expect(canvas.getObjects().length).toBe(0);
  });

  test("deleting single object still creates one history entry", async () => {
    canvas.add(rect);
    canvas.add(circle);
    canvas.renderAll();
    events.length = 0;

    // Remove just one object (no multi-selection)
    canvas.remove(rect);

    const historyAppendEvents = events.filter((e) =>
      e.includes("history:append")
    );

    expect(historyAppendEvents.length).toBe(1);
    expect(canvas.getObjects().length).toBe(1);

    // Undo should restore rect
    await canvas.undo();
    expect(canvas.getObjects().length).toBe(2);
  });

  afterEach(() => {
    canvas.dispose();
    document.body.removeChild(canvasEl);
  });
});
