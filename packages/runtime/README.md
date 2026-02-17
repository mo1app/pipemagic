# PipeMagic

Standalone runtime for [PipeMagic](https://github.com/mo1app/pipemagic). Build asset processing pipelines with the [node-based editor](https://pipemagic.mo1.app/), then run them in any web app with this package. Supports AI models via WebGPU — no server required.

## Install

```sh
npm install pipemagic
```

AI nodes (remove-bg, depth, face-parse) require `@huggingface/transformers` (optional peer dependency):

```sh
npm install @huggingface/transformers
```

## Quick Start

```ts
import { PipeMagic } from "pipemagic";

const pm = new PipeMagic();

const result = await pm.run(pipeline, imageFile, {
  onNodeProgress(nodeId, progress) {
    console.log(`${nodeId}: ${Math.round(progress * 100)}%`);
  },
});

// result.blob  → output image as Blob
// result.width, result.height → dimensions
```

### Multiple inputs

Pipelines with multiple input nodes accept a record keyed by node label or ID:

```ts
const result = await pm.run(pipeline, {
  "Image Input": file1,
  "Background": file2,
});
```

Values can be `Blob`, `File`, or `ImageBitmap`. A single value (not a record) is still supported for pipelines with one input.

### Multiple outputs

`RunResult` includes all output nodes, keyed by label:

```ts
const result = await pm.run(pipeline, imageFile);

// Primary output (first output node)
result.blob; // Blob
result.width;
result.height;

// All outputs by label
for (const [label, entry] of Object.entries(result.outputs)) {
  entry.asset; // Blob
  entry.width;
  entry.height;
  entry.data; // optional structured data (e.g. spritesheet frame data)
}
```

## Pipeline Definition

Pipelines are JSON graphs of nodes and edges. Each node has a type, parameters, and connects to other nodes via edges.

You can create them with the official [Node Editor](https://pipemagic.mo1.app).

## Node Types

### `input`

Resizes the source image to fit within bounds.

| Param     | Type                             | Default     | Description          |
| --------- | -------------------------------- | ----------- | -------------------- |
| `maxSize` | `number`                         | `2048`      | Maximum width/height |
| `fit`     | `'contain' \| 'cover' \| 'fill'` | `'contain'` | Resize mode          |

### `remove-bg`

Removes the background using [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) via transformers.js. Requires `@huggingface/transformers`.

| Param       | Type                           | Default  | Description            |
| ----------- | ------------------------------ | -------- | ---------------------- |
| `threshold` | `number`                       | `0.5`    | Segmentation threshold |
| `device`    | `'webgpu' \| 'wasm' \| 'auto'` | `'auto'` | Inference device       |
| `dtype`     | `'fp32' \| 'fp16' \| 'q8'`     | `'fp16'` | Model precision        |

### `normalize`

Crops to content bounding box and centers on a square canvas with padding.

| Param     | Type     | Default | Description            |
| --------- | -------- | ------- | ---------------------- |
| `size`    | `number` | `1024`  | Output canvas size     |
| `padding` | `number` | `16`    | Padding around content |

### `outline`

Adds an outline around non-transparent content using Jump Flooding Algorithm (WebGPU) with canvas fallback.

| Param       | Type                                | Default     | Description             |
| ----------- | ----------------------------------- | ----------- | ----------------------- |
| `thickness` | `number`                            | `4`         | Outline width in pixels |
| `color`     | `string`                            | `'#ffffff'` | Outline color (hex)     |
| `opacity`   | `number`                            | `1`         | Outline opacity (0-1)   |
| `quality`   | `'low' \| 'medium' \| 'high'`       | `'medium'`  | Rendering quality       |
| `position`  | `'outside' \| 'center' \| 'inside'` | `'outside'` | Outline placement       |
| `threshold` | `number`                            | `0`         | Distance field offset   |

### `depth`

Monocular depth estimation using [Depth Anything V2](https://huggingface.co/onnx-community/depth-anything-v2-small) via transformers.js. Outputs a grayscale depth map. Requires `@huggingface/transformers`.

| Param    | Type                           | Default  | Description        |
| -------- | ------------------------------ | -------- | ------------------ |
| `model`  | `'fast' \| 'quality'`          | `'fast'` | Model size (~25/~40 MB) |
| `device` | `'webgpu' \| 'wasm' \| 'auto'` | `'auto'` | Inference device   |

### `face-parse`

Face segmentation into 19 classes (skin, eyes, brows, nose, mouth, lips, ears, hair, hat, neck, cloth, etc.) using [face-parsing](https://huggingface.co/Xenova/face-parsing) via transformers.js. Outputs a color-coded segmentation map. Requires `@huggingface/transformers`.

| Param    | Type                           | Default  | Description      |
| -------- | ------------------------------ | -------- | ---------------- |
| `device` | `'webgpu' \| 'wasm' \| 'auto'` | `'auto'` | Inference device |

### `upscale`

2x upscaling via [WebSR](https://github.com/nicknbytes/websr) (loaded from CDN at runtime). Requires WebGPU.

| Param         | Type                                     | Default      | Description       |
| ------------- | ---------------------------------------- | ------------ | ----------------- |
| `model`       | `'cnn-2x-s' \| 'cnn-2x-m' \| 'cnn-2x-l'` | `'cnn-2x-s'` | Model size        |
| `contentType` | `'rl' \| 'an' \| '3d'`                   | `'rl'`       | Content type hint |

### `spritesheet`

Composites multiple input images into a grid spritesheet. Accepts multiple connections on its `images` input handle. Outputs the combined image plus a JSON data object with per-frame positions and UV coordinates.

| Param     | Type                 | Default         | Description                        |
| --------- | -------------------- | --------------- | ---------------------------------- |
| `columns` | `number \| 'auto'`   | `'auto'`        | Number of columns (auto = √n)      |
| `rows`    | `number \| 'auto'`   | `'auto'`        | Number of rows (auto = ceil(n/cols))|
| `gap`     | `number`             | `0`             | Gap between cells in pixels        |
| `bgColor` | `string`             | `'transparent'` | Background color (hex or `'transparent'`) |

### `output`

Encodes the final image as a Blob. Also accepts an optional `data` input handle for passing through structured data (e.g. spritesheet frame coordinates).

| Param     | Type                        | Default | Description         |
| --------- | --------------------------- | ------- | ------------------- |
| `format`  | `'png' \| 'jpeg' \| 'webp'` | `'png'` | Output format       |
| `quality` | `number`                    | `0.92`  | Compression quality |

## Callbacks

All callbacks are optional:

```ts
await pm.run(pipeline, image, {
  // Per-node progress (0 to 1)
  onNodeProgress(nodeId, progress) {},

  // Status changes: 'pending' | 'running' | 'done' | 'error' | 'cached'
  onNodeStatus(nodeId, status, error?) {},

  // Status messages (e.g. "Loading model...", "Upscaling...")
  onNodeStatusMessage(nodeId, message) {},

  // Model download progress (0 to 1, or null when done)
  onNodeDownloadProgress(nodeId, progress) {},

  // AbortSignal to cancel the pipeline
  signal: abortController.signal,
});
```

## Using Individual Executors

You can also use executors directly without a pipeline:

```ts
import {
  executeRemoveBg,
  executeOutline,
  executeDepth,
  executeFaceParse,
  executeSpritesheet,
  initGpu,
  getGpuDevice,
  createFrame,
} from "pipemagic";

await initGpu();

const inputFrame = createFrame(await createImageBitmap(file));
const ctx = {
  abortSignal: new AbortController().signal,
  gpuDevice: getGpuDevice(),
  onProgress: () => {},
  onStatus: () => {},
};

const result = await executeRemoveBg(ctx, [inputFrame], {
  threshold: 0.5,
  device: "auto",
  dtype: "fp16",
});
```

## Custom Executors

Register custom node executors to extend the pipeline with your own processing steps:

```ts
import { registerExecutor } from "pipemagic";

registerExecutor("my-node", async (ctx, inputs, params) => {
  const image = inputs.asset; // ImageFrame
  // ... process image ...
  return { asset: outputFrame };
});
```

## Browser Requirements

- **WebGPU** — required for outline (JFA) and upscale (WebSR). Falls back to canvas for outline if unavailable.
- **SharedArrayBuffer** — required by the ONNX runtime used in AI nodes (remove-bg, depth, face-parse). Your page needs these headers:
  ```
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin
  ```
- Models and WebSR weights are loaded from CDN on first use — no bundling required.

## License

MIT
