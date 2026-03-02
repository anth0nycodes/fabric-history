import { EraserBrush } from "@erase2d/fabric";
import { PencilBrush, type CanvasEvents, type FabricObject } from "fabric";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { CanvasWithHistory } from "../../src/canvas.js";

describe("Path creation and erasing events", () => {
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
      "path:created",
      "erasing:end",
      "object:added",
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

  /** Helper to simulate drawing/erasing gesture on the canvas */
  function simulateDrawingGesture(
    upperCanvas: HTMLCanvasElement,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    steps = 5
  ) {
    const rect = upperCanvas.getBoundingClientRect();
    const actualStartX = rect.left + startX;
    const actualStartY = rect.top + startY;
    const actualEndX = rect.left + endX;
    const actualEndY = rect.top + endY;

    // Mouse down to start
    upperCanvas.dispatchEvent(
      new MouseEvent("mousedown", {
        clientX: actualStartX,
        clientY: actualStartY,
        bubbles: true,
      })
    );

    // Mouse move in steps
    for (let i = 1; i <= steps; i++) {
      const currentX = actualStartX + ((actualEndX - actualStartX) * i) / steps;
      const currentY = actualStartY + ((actualEndY - actualStartY) * i) / steps;
      upperCanvas.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: currentX,
          clientY: currentY,
          bubbles: true,
        })
      );
    }

    // Mouse up to finish
    upperCanvas.dispatchEvent(
      new MouseEvent("mouseup", {
        clientX: actualEndX,
        clientY: actualEndY,
        bubbles: true,
      })
    );
  }

  test("path:created fires when drawing with PencilBrush", async () => {
    // Set up PencilBrush for free drawing
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.width = 5;
    canvas.isDrawingMode = true;

    // Get the upper canvas (Fabric handles pointer events here)
    const wrapper = canvasEl.parentElement!;
    const upperCanvas = wrapper.querySelector(
      ".upper-canvas"
    ) as HTMLCanvasElement;

    // Simulate drawing a path
    simulateDrawingGesture(upperCanvas, 100, 100, 200, 150);

    // Verify path:created was fired
    const pathCreatedEvents = events.filter((e) => e.includes("path:created"));
    console.log("Events fired:", events);

    expect(pathCreatedEvents.length).toBe(1);
    expect(canvas.getObjects().length).toBe(1);
    expect(canvas.getObjects()[0].type).toBe("path");
  });

  /**
   * This test verifies erasing:end fires when using EraserBrush via setEraserBrush.
   * Related to: https://github.com/anth0nycodes/fabric-history/issues/15
   */
  test("erasing:end fires when erasing a path", async () => {
    // Get the upper canvas
    const wrapper = canvasEl.parentElement!;
    const upperCanvas = wrapper.querySelector(
      ".upper-canvas"
    ) as HTMLCanvasElement;

    // Step 1: Draw a path first
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.width = 10;
    canvas.isDrawingMode = true;

    simulateDrawingGesture(upperCanvas, 100, 100, 300, 100);

    expect(canvas.getObjects().length).toBe(1);

    // Ensure the path is erasable
    const path = canvas.getObjects()[0];
    path.set("erasable", true);
    canvas.renderAll();

    console.log("After drawing - Events:", events);
    console.log("Path erasable:", path.get("erasable"));
    events.length = 0; // Clear events

    // Step 2: Switch to EraserBrush using setEraserBrush (bridges @erase2d/fabric events)
    const eraser = new EraserBrush(canvas);
    eraser.width = 20;
    canvas.setEraserBrush(eraser);
    canvas.isDrawingMode = true;

    // Erase over the same area where the path was drawn
    simulateDrawingGesture(upperCanvas, 100, 100, 300, 100);

    console.log("After erasing - Events:", events);
    console.log("Objects after erasing:", canvas.getObjects().length);

    // Verify erasing:end was fired
    const erasingEndEvents = events.filter((e) => e.includes("erasing:end"));
    expect(erasingEndEvents.length).toBe(1);
  });
});
