# fabric-history

A library built on top of fabric.js that provides undo/redo history management for canvas operations.

## Features

- Undo/Redo functionality for fabric.js canvases
- Automatic history tracking for object additions, removals, and modifications
- Support for path creation and erasing events
- Easy integration with existing fabric.js projects
- Support for fabric.js v6 and v7

## Installation

```bash
npm install @anth0nycodes/fabric-history
```

or with pnpm:

```bash
pnpm add @anth0nycodes/fabric-history
```

or with yarn:

```bash
yarn add @anth0nycodes/fabric-history
```

## Usage

```typescript
import { CanvasWithHistory } from "@anth0nycodes/fabric-history";
import { Rect } from "fabric";

// Create a canvas with history support (same constructor as fabric.Canvas)
const canvas = new CanvasWithHistory("my-canvas", {
  width: 800,
  height: 600,
});

// Add objects - history is tracked automatically
const rect = new Rect({
  left: 100,
  top: 100,
  width: 50,
  height: 50,
  fill: "red",
});
canvas.add(rect);

// Undo the last action
await canvas.undo();

// Redo the undone action
await canvas.redo();

// Clear history if needed
canvas.clearHistory();
```

## API

### `CanvasWithHistory`

Extends fabric.js `Canvas` class with history management capabilities.

#### Methods

| Method           | Returns         | Description                                     |
| ---------------- | --------------- | ----------------------------------------------- |
| `undo()`         | `Promise<void>` | Undo the most recent action                     |
| `redo()`         | `Promise<void>` | Redo the most recently undone action            |
| `canUndo()`      | `boolean`       | Check if an undo action is available            |
| `canRedo()`      | `boolean`       | Check if a redo action is available             |
| `clearHistory()` | `void`          | Clear all undo and redo history                 |
| `dispose()`      | `void`          | Clean up event listeners and dispose the canvas |

#### Tracked Events

History is automatically saved when these fabric.js events occur:

- `object:added` - When an object is added to the canvas
- `object:removed` - When an object is removed from the canvas
- `object:modified` - When an object is modified (moved, scaled, rotated, etc.)
- `path:created` - When a path is created (e.g., freehand drawing)
- `erasing:end` - When an erasing operation completes
- `canvas:cleared` - When the canvas is cleared

## Requirements

- fabric.js 6.x or 7.x

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build the project
pnpm build

# Type check
pnpm check

# Run tests
pnpm test

# Run tests with coverage
pnpm coverage
```

## Contributing

Contributions are welcome! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to submit pull requests.

## License

MIT

## Author

Anthony Hoang
