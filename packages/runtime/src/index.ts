import type { PipelineDefinition } from './types/pipeline'
import type { RunOptions, RunResult } from './runner'
import { runPipeline } from './runner'
import { initGpu, getGpuDevice } from './utils/gpu'

export class PipeMagic {
  private gpuInitialized = false

  async run(
    pipeline: PipelineDefinition,
    inputImage: Blob | File | ImageBitmap | Record<string, Blob | File | ImageBitmap>,
    options: RunOptions = {},
  ): Promise<RunResult> {
    // Init GPU once
    if (!this.gpuInitialized) {
      await initGpu()
      this.gpuInitialized = true
    }

    // Convert input(s) to ImageBitmap
    if (inputImage instanceof Blob || inputImage instanceof File || inputImage instanceof ImageBitmap) {
      // Single input (backward-compat)
      const bitmap = inputImage instanceof ImageBitmap
        ? inputImage
        : await createImageBitmap(inputImage)
      return runPipeline(pipeline, bitmap, getGpuDevice(), options)
    } else {
      // Multi-input: Record<string, Blob | File | ImageBitmap>
      const bitmapMap = new Map<string, ImageBitmap>()
      for (const [key, value] of Object.entries(inputImage)) {
        const bitmap = value instanceof ImageBitmap
          ? value
          : await createImageBitmap(value)
        bitmapMap.set(key, bitmap)
      }
      return runPipeline(pipeline, bitmapMap, getGpuDevice(), options)
    }
  }
}

// Re-export everything consumers might need
export { runPipeline, registerExecutor } from './runner'
export type { RunOptions, RunResult, OutputEntry, NodeExecutor, LegacyNodeExecutor } from './runner'

export { initGpu, getGpuDevice } from './utils/gpu'

export type {
  ImageFrame,
  NodeStatus,
  NodeState,
  NodeOutput,
  ExecutionContext,
  NodeType,
  NodePosition,
  NodeDef,
  EdgeDef,
  PipelineDefinition,
  InputNodeParams,
  OutputNodeParams,
  RemoveBgParams,
  UpscaleParams,
  NormalizeParams,
  OutlineParams,
  DepthParams,
  FaceParseParams,
  SpritesheetParams,
  NodeParamsMap,
  HandleDataType,
  HandleDef,
} from './types'
export { createDefaultNodeState, DEFAULT_PARAMS } from './types'

export { getHandleDefs } from './registry'
export type { NodeHandleDefs } from './registry'

export {
  topoSort,
  hasCycle,
  validatePipeline,
  getUpstreamNodes,
  getUpstreamEdges,
  getDownstreamNodes,
} from './utils/graph'
export type { ValidationError } from './utils/graph'

export { computeCacheKey } from './utils/hash'

export {
  bitmapToCanvas,
  bitmapToImageData,
  imageDataToBitmap,
  resizeBitmap,
  bitmapToBlob,
  fileToBitmap,
  bitmapToDataUrl,
} from './utils/image'

export {
  bitmapToTexture,
  textureToBitmap,
  createFrame,
} from './utils/gpu'

export { executeRemoveBg } from './executors/remove-bg'
export { executeNormalize } from './executors/normalize'
export { executeUpscale } from './executors/upscale'
export { executeOutline } from './executors/outline'
export { executeDepth } from './executors/depth'
export { executeFaceParse } from './executors/face-parse'
export { executeSpritesheet } from './executors/spritesheet'
export type { SpritesheetData, SpritesheetFrame } from './executors/spritesheet'
