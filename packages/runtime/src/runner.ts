import type { NodeType, NodeDef, EdgeDef, PipelineDefinition } from './types/pipeline'
import type { ImageFrame } from './types/image-frame'
import type { ExecutionContext, NodeStatus, NodeState, NodeOutput } from './types/execution'
import { createDefaultNodeState } from './types/execution'
import { topoSort, getUpstreamEdges, validatePipeline } from './utils/graph'
import { computeCacheKey } from './utils/hash'
import { resizeBitmap } from './utils/image'
import { createFrame } from './utils/gpu'
import { getHandleDefs } from './registry'
import { executeRemoveBg } from './executors/remove-bg'
import { executeUpscale } from './executors/upscale'
import { executeNormalize } from './executors/normalize'
import { executeOutline } from './executors/outline'
import { executeDepth } from './executors/depth'
import { executeFaceParse } from './executors/face-parse'
import { executeSpritesheet } from './executors/spritesheet'

/** Legacy executor signature (single ImageFrame[] in, single ImageFrame out). */
export type LegacyNodeExecutor = (
  ctx: ExecutionContext,
  inputs: ImageFrame[],
  params: Record<string, unknown>,
) => Promise<ImageFrame>

/** New executor signature: named inputs, NodeOutput out. */
export type NodeExecutor = (
  ctx: ExecutionContext,
  inputs: Record<string, ImageFrame | ImageFrame[]>,
  params: Record<string, unknown>,
) => Promise<NodeOutput>

/** Wrap a legacy executor to the new signature. */
function wrapExecutor(fn: LegacyNodeExecutor): NodeExecutor {
  return async (ctx, inputs, params) => {
    const flat = Object.values(inputs).flat() as ImageFrame[]
    return { asset: await fn(ctx, flat, params) }
  }
}

const legacyExecutors: Record<string, LegacyNodeExecutor> = {
  'remove-bg': executeRemoveBg,
  'normalize': executeNormalize,
  'upscale': executeUpscale,
  'outline': executeOutline,
  'depth': executeDepth,
  'face-parse': executeFaceParse,
}

const executors: Record<string, NodeExecutor> = {
  'spritesheet': executeSpritesheet,
}
for (const [key, fn] of Object.entries(legacyExecutors)) {
  executors[key] = wrapExecutor(fn)
}

/** Register a native v2 executor (e.g. spritesheet). */
export function registerExecutor(nodeType: string, executor: NodeExecutor) {
  executors[nodeType] = executor
}

// Keep the old type name as an alias for backwards compat
export { LegacyNodeExecutor as NodeExecutorLegacy }

export interface RunOptions {
  signal?: AbortSignal
  onNodeProgress?: (nodeId: string, progress: number) => void
  onNodeStatus?: (nodeId: string, status: NodeStatus, error?: string) => void
  onNodeStatusMessage?: (nodeId: string, message: string | null) => void
  onNodeDownloadProgress?: (nodeId: string, progress: number | null) => void
}

export interface OutputEntry {
  asset?: Blob
  width?: number
  height?: number
  data?: unknown
}

export interface RunResult {
  blob: Blob
  width: number
  height: number
  outputs: Record<string, OutputEntry>
  nodeOutputs: Map<string, NodeOutput>
}

/** Migrate v1 handle names to v2. */
function migrateEdges(edges: EdgeDef[]): EdgeDef[] {
  return edges.map(e => ({
    ...e,
    sourceHandle: e.sourceHandle === 'output' ? 'asset' : e.sourceHandle,
    targetHandle: e.targetHandle === 'input' ? 'asset' : e.targetHandle,
  }))
}

function isOutputNodeType(type: NodeType): boolean {
  return type === 'output' || type === 'output-image' || type === 'output-data'
}

export async function runPipeline(
  pipeline: PipelineDefinition,
  inputImage: ImageBitmap | Map<string, ImageBitmap>,
  gpuDevice: GPUDevice | null,
  options: RunOptions = {},
): Promise<RunResult> {
  const { nodes } = pipeline
  const edges = migrateEdges(pipeline.edges)
  const { signal, onNodeProgress, onNodeStatus, onNodeStatusMessage, onNodeDownloadProgress } = options
  const defaultInputNodeId = nodes.find(n => n.type === 'input' && n.isDefault)?.id
    ?? nodes.find(n => n.type === 'input')?.id

  // Validate
  const errors = validatePipeline(nodes, edges)
  if (errors.length > 0) {
    throw new Error(`Pipeline validation failed: ${errors.map(e => e.message).join('; ')}`)
  }

  // Normalize input to Map
  const inputMap: Map<string, ImageBitmap> = inputImage instanceof Map
    ? inputImage
    : new Map([['__default__', inputImage]])

  // Set up abort
  const abortSignal = signal ?? new AbortController().signal

  // Local node state
  const nodeStates = new Map<string, NodeState>()
  for (const node of nodes) {
    nodeStates.set(node.id, createDefaultNodeState())
  }

  function updateState(nodeId: string, update: Partial<NodeState>) {
    const state = nodeStates.get(nodeId)
    if (state) Object.assign(state, update)
  }

  // Build execution context
  const ctx: ExecutionContext = {
    abortSignal,
    gpuDevice,
    onProgress: (nodeId, progress) => {
      updateState(nodeId, { progress })
      onNodeProgress?.(nodeId, progress)
    },
    onStatus: (nodeId, status, error) => {
      updateState(nodeId, { status, error: error || null })
      onNodeStatus?.(nodeId, status, error)
    },
    onStatusMessage: (nodeId, message) => {
      updateState(nodeId, { statusMessage: message })
      onNodeStatusMessage?.(nodeId, message)
    },
    onDownloadProgress: (nodeId, progress) => {
      updateState(nodeId, { downloadProgress: progress })
      onNodeDownloadProgress?.(nodeId, progress)
    },
  }

  // Topo sort
  const order = topoSort(nodes, edges)

  // Track output nodes for final result
  const outputNodeIds: string[] = []

  // Execute in order
  for (const nodeId of order) {
    if (abortSignal.aborted) throw new DOMException('Aborted', 'AbortError')

    const node = nodes.find(n => n.id === nodeId)
    if (!node) continue

    const nodeType = node.type as NodeType
    const params = node.params || {}

    // Handle-aware input gathering
    const upstreamEdges = getUpstreamEdges(nodeId, edges)
    const handleDefs = getHandleDefs(nodeType)
    const inputs: Record<string, ImageFrame | ImageFrame[]> = {}
    const inputRevisions: Record<string, number[]> = {}

    for (const edge of upstreamEdges) {
      const upState = nodeStates.get(edge.source)
      if (!upState?.output) continue

      const sourceOutput = upState.output[edge.sourceHandle]
      if (!sourceOutput) continue

      const targetHandle = edge.targetHandle
      const handleDef = handleDefs.targets.find(h => h.id === targetHandle)

      const sourceRevision = (typeof sourceOutput === 'object' && sourceOutput && 'revision' in (sourceOutput as Record<string, unknown>))
        ? Number((sourceOutput as Record<string, unknown>).revision)
        : 0

      if (handleDef?.multi) {
        // Accumulate into array
        if (!inputs[targetHandle]) {
          inputs[targetHandle] = []
          inputRevisions[targetHandle] = []
        }
        ;(inputs[targetHandle] as ImageFrame[]).push(sourceOutput as ImageFrame)
        ;(inputRevisions[targetHandle] as number[]).push(sourceRevision)
      } else {
        inputs[targetHandle] = sourceOutput as ImageFrame
        inputRevisions[targetHandle] = [sourceRevision]
      }
    }

    // Check cache
    const cacheKey = computeCacheKey(nodeId, params, inputRevisions)
    const existingState = nodeStates.get(nodeId)!
    if (existingState.cacheKey === cacheKey && existingState.output) {
      updateState(nodeId, { status: 'cached' })
      onNodeStatus?.(nodeId, 'cached')
      if (isOutputNodeType(nodeType)) outputNodeIds.push(nodeId)
      continue
    }

    // Execute
    updateState(nodeId, { status: 'running', progress: 0 })
    onNodeStatus?.(nodeId, 'running')

    try {
      let output: NodeOutput

      if (nodeType === 'input') {
        // Look up input image by label, then by id, then default for the default input node
        const label = node.label || node.id
        let bitmap = inputMap.get(label) ?? inputMap.get(node.id)
        if (!bitmap && node.id === defaultInputNodeId) {
          bitmap = inputMap.get('__default__')
        }
        if (!bitmap) {
          const isConnected = edges.some((e) => e.source === nodeId)
          if (!isConnected) {
            output = {}
          } else {
            throw new Error(`No input image for "${label}"`)
          }
        } else {
          if (!(bitmap instanceof ImageBitmap)) {
            throw new Error(`runner: input "${label}" bitmap is ${Object.prototype.toString.call(bitmap)}, not ImageBitmap`)
          }
          const maxSize = (params.maxSize as number) || 2048
          const fit = (params.fit as 'contain' | 'cover' | 'fill') || 'contain'
          const resized = await resizeBitmap(bitmap, maxSize, fit)
          output = { asset: createFrame(resized) }
        }
      } else if (nodeType === 'output' || nodeType === 'output-image') {
        const firstInput = Object.values(inputs)[0] as ImageFrame | undefined
        if (!firstInput) throw new Error('No input to output node')
        output = { asset: firstInput }
        outputNodeIds.push(nodeId)
      } else if (nodeType === 'output-data') {
        const dataInput = inputs.data
        if (dataInput === undefined) throw new Error('No data input to output node')
        output = { data: dataInput }
        outputNodeIds.push(nodeId)
      } else {
        const executor = executors[nodeType]
        if (!executor) throw new Error(`No executor for node type: ${nodeType}`)

        const hasInputs = Object.keys(inputs).length > 0
        if (!hasInputs) throw new Error('No input image')

        // Create per-node context
        const nodeCtx: ExecutionContext = {
          ...ctx,
          onProgress: (_id, progress) => ctx.onProgress(nodeId, progress),
          onStatus: (_id, status, error) => ctx.onStatus(nodeId, status, error),
          onStatusMessage: (_id, message) => ctx.onStatusMessage?.(nodeId, message),
          onDownloadProgress: (_id, progress) => ctx.onDownloadProgress?.(nodeId, progress),
        }
        output = await executor(nodeCtx, inputs, params)
      }

      updateState(nodeId, {
        status: 'done',
        progress: 1,
        statusMessage: null,
        downloadProgress: null,
        output,
        cacheKey,
        error: null,
      })
      onNodeStatus?.(nodeId, 'done')
    } catch (e: any) {
      if (e.name === 'AbortError' || abortSignal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      updateState(nodeId, {
        status: 'error',
        error: e.message || 'Unknown error',
      })
      onNodeStatus?.(nodeId, 'error', e.message)
    }
  }

  // Build results from all output nodes
  const { bitmapToBlob } = await import('./utils/image')
  const outputs: Record<string, OutputEntry> = {}

  for (const outId of outputNodeIds) {
    const outNode = nodes.find(n => n.id === outId)!
    const outState = nodeStates.get(outId)
    if (!outState?.output) continue

    const label = outNode.label || outNode.id
    if (outNode.type === 'output-data') {
      outputs[label] = { data: outState.output.data }
    } else {
      const format = (outNode.params?.format as 'png' | 'jpeg' | 'webp') || 'png'
      const quality = (outNode.params?.quality as number) ?? 0.92
      const assetFrame = outState.output.asset
      if (!assetFrame) continue
      const blob = await bitmapToBlob(assetFrame.bitmap, format, quality)
      outputs[label] = {
        asset: blob,
        width: assetFrame.width,
        height: assetFrame.height,
        data: outState.output.data,
      }
    }
  }

  // Primary output: first output node
  const imageOutputIds = outputNodeIds.filter(id => {
    const type = nodes.find(n => n.id === id)?.type
    return type === 'output' || type === 'output-image'
  })
  const defaultOutputId = imageOutputIds.find(id => nodes.find(n => n.id === id)?.isDefault)
  const primaryOutputId = defaultOutputId ?? imageOutputIds[0]
  const primaryState = primaryOutputId ? nodeStates.get(primaryOutputId) : null
  if (!primaryState?.output?.asset) {
    throw new Error('Pipeline produced no output')
  }

  const primaryNode = nodes.find(n => n.id === primaryOutputId)!
  const primaryFormat = (primaryNode.params?.format as 'png' | 'jpeg' | 'webp') || 'png'
  const primaryQuality = (primaryNode.params?.quality as number) ?? 0.92
  const primaryFrame = primaryState.output.asset
  const primaryBlob = await bitmapToBlob(primaryFrame.bitmap, primaryFormat, primaryQuality)

  // Collect all node outputs
  const nodeOutputs = new Map<string, NodeOutput>()
  for (const [id, state] of nodeStates) {
    if (state.output) nodeOutputs.set(id, state.output)
  }

  return {
    blob: primaryBlob,
    width: primaryFrame.width,
    height: primaryFrame.height,
    outputs,
    nodeOutputs,
  }
}
