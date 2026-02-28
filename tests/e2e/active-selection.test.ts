import { Canvas, Circle, Rect } from "fabric";
import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

test("explore: what events fire when dragging an ActiveSelection", async () => {
  // Create a canvas element in the DOM
  const canvasEl = document.createElement("canvas");
  canvasEl.id = "test-canvas";
  canvasEl.width = 800;
  canvasEl.height = 600;
  document.body.appendChild(canvasEl);

  const events: string[] = [];
  const canvas = new Canvas(canvasEl, {
    width: 800,
    height: 600,
  });

  // Track events
  const eventsToTrack = [
    "object:added",
    "object:removed",
    "object:modified",
    "object:moving",
    "selection:created",
    "selection:updated",
    "selection:cleared",
  ];

  eventsToTrack.forEach((eventName) => {
    canvas.on(eventName as any, (e: any) => {
      const targetType = e?.target?.type || "unknown";
      events.push(`${eventName} (${targetType})`);
      console.log(`EVENT: ${eventName} (target: ${targetType})`);
    });
  });

  // Add two objects
  const rect = new Rect({
    left: 100,
    top: 100,
    width: 80,
    height: 60,
    fill: "red",
  });

  const circle = new Circle({
    left: 250,
    top: 100,
    radius: 40,
    fill: "blue",
  });

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

  // Simulate drag by dispatching mouse events directly
  const mouseDown = new MouseEvent("mousedown", {
    clientX: canvasEl.getBoundingClientRect().left + startX,
    clientY: canvasEl.getBoundingClientRect().top + startY,
    bubbles: true,
  });
  canvasEl.dispatchEvent(mouseDown);

  // Simulate movement in steps
  for (let i = 1; i <= 5; i++) {
    const currentX =
      canvasEl.getBoundingClientRect().left +
      startX +
      ((endX - startX) * i) / 5;
    const currentY =
      canvasEl.getBoundingClientRect().top + startY + ((endY - startY) * i) / 5;
    const mouseMove = new MouseEvent("mousemove", {
      clientX: currentX,
      clientY: currentY,
      bubbles: true,
    });
    canvasEl.dispatchEvent(mouseMove);
  }

  const mouseUp = new MouseEvent("mouseup", {
    clientX: canvasEl.getBoundingClientRect().left + endX,
    clientY: canvasEl.getBoundingClientRect().top + endY,
    bubbles: true,
  });
  canvasEl.dispatchEvent(mouseUp);

  console.log("--- Drag events:", events);

  // Log summary
  const modifiedEvents = events.filter((e) => e.includes("object:modified"));
  const movingEvents = events.filter((e) => e.includes("object:moving"));

  console.log(`\n=== SUMMARY ===`);
  console.log(`object:moving fired ${movingEvents.length} times`);
  console.log(`object:modified fired ${modifiedEvents.length} times`);
  console.log(`Modified event targets: ${modifiedEvents.join(", ")}`);

  expect(true).toBe(true);

  // Cleanup
  canvas.dispose();
  document.body.removeChild(canvasEl);
});
