import { toRaw } from 'vue'
import { usePipelineStore } from '~/stores/pipeline'
import {
  initGpu,
  getGpuDevice,
  createFrame,
  topoSort,
  getUpstreamEdges,
  getHandleDefs,
  validatePipeline,
  computeCacheKey,
  resizeBitmap,
  executeRemoveBg,
  executeUpscale,
  executeNormalize,
  executeOutline,
  executeDepth,
  executeFaceParse,
  executeSpritesheet,
} from 'pipemagic'
import type {
  NodeType,
  NodeDef,
  EdgeDef,
  ImageFrame,
  NodeOutput,
  ExecutionContext,
  LegacyNodeExecutor,
  NodeExecutor,
} from 'pipemagic'

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

export function usePipelineRunner() {
  const store = usePipelineStore()
  const runError = ref<string | null>(null)

  async function run() {
    // Validate
    const nodeDefs = store.nodes.map((n: any) => ({
      id: n.id,
      type: n.type as NodeType,
      position: n.position,
      params: n.data?.params || {},
    })) as NodeDef[]

    const edgeDefs = store.edges.map((e: any) => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle || 'asset',
      target: e.target,
      targetHandle: e.targetHandle || 'asset',
    })) as EdgeDef[]

    const errors = validatePipeline(nodeDefs, edgeDefs)
    if (errors.length > 0) {
      const msg = errors.map(e => e.message).join('\n')
      console.warn('Pipeline validation errors:', msg)
      runError.value = msg
      return
    }

    // Check input images (only required for connected input nodes)
    const inputNodes = store.nodes.filter((n: any) => n.type === 'input')
    for (const inputNode of inputNodes) {
      const isConnected = store.edges.some((e: any) => e.source === inputNode.id)
      if (!isConnected) continue
      if (!store.inputImages.has(inputNode.id)) {
        runError.value = 'Please add an image to the Input node before running.'
        return
      }
    }
    runError.value = null

    // Init GPU (optional)
    await initGpu()

    // Set up abort
    const abortController = new AbortController()
    store.abortController = abortController
    store.isRunning = true

    // Clear previous execution states (keep caches)
    for (const node of store.nodes) {
      const state = store.getNodeState(node.id)
      if (state.status !== 'done' && state.status !== 'cached') {
        store.updateNodeState(node.id, { status: 'pending', progress: 0, error: null })
      }
    }

    // Build execution context
    const ctx: ExecutionContext = {
      abortSignal: abortController.signal,
      gpuDevice: getGpuDevice(),
      onProgress: (nodeId, progress) => {
        store.updateNodeState(nodeId, { progress })
      },
      onStatus: (nodeId, status, error) => {
        store.updateNodeState(nodeId, { status, error: error || null })
      },
      onStatusMessage: (nodeId, message) => {
        store.updateNodeState(nodeId, { statusMessage: message })
      },
      onDownloadProgress: (nodeId, progress) => {
        store.updateNodeState(nodeId, { downloadProgress: progress })
      },
    }

    try {
      // Topo sort
      const order = topoSort(nodeDefs, edgeDefs)
      console.log('[pipeline] execution order:', order)

      // Execute in order
      for (const nodeId of order) {
        if (abortController.signal.aborted) break

        const node = store.nodes.find((n: any) => n.id === nodeId)
        if (!node) continue

        const nodeType = node.type as NodeType
        const params = node.data?.params || {}
        console.log(`[pipeline] executing node ${nodeId} (${nodeType})`)

        // Handle-aware input gathering
        const upstreamEdges = getUpstreamEdges(nodeId, edgeDefs)
        const handleDefs = getHandleDefs(nodeType)
        const inputs: Record<string, ImageFrame | ImageFrame[]> = {}
        const inputRevisions: Record<string, number[]> = {}

        for (const edge of upstreamEdges) {
          const upState = store.getNodeState(edge.source)
          if (!upState.output) continue

          const rawOutput = toRaw(upState.output)
          const sourceOutput = toRaw(rawOutput[edge.sourceHandle])
          if (!sourceOutput) continue

          const targetHandle = edge.targetHandle
          const handleDef = handleDefs.targets.find(h => h.id === targetHandle)
          const sourceRevision = (typeof sourceOutput === 'object' && sourceOutput && 'revision' in (sourceOutput as Record<string, unknown>))
            ? Number((sourceOutput as Record<string, unknown>).revision)
            : 0

          if (handleDef?.multi) {
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
        const existingState = store.getNodeState(nodeId)
        if (existingState.cacheKey === cacheKey && existingState.output) {
          store.updateNodeState(nodeId, { status: 'cached' })
          continue
        }

        // Execute
        store.updateNodeState(nodeId, { status: 'running', progress: 0 })

        try {
          let output: NodeOutput

          if (nodeType === 'input') {
            const frame = store.inputImages.get(nodeId)
            if (!frame) {
              const isConnected = edgeDefs.some((e) => e.source === nodeId)
              if (!isConnected) {
                output = {}
                store.updateNodeState(nodeId, { cacheKey: null })
              } else {
                throw new Error('No input image')
              }
            } else {
            const rawBitmap = toRaw(frame.bitmap) as ImageBitmap
            if (!(rawBitmap instanceof ImageBitmap)) {
              throw new Error(`Input node "${nodeId}": bitmap is ${Object.prototype.toString.call(rawBitmap)}, not ImageBitmap`)
            }
            const maxSize = (params.maxSize as number) || 2048
            const fit = (params.fit as 'contain' | 'cover' | 'fill') || 'contain'
            const resized = await resizeBitmap(rawBitmap, maxSize, fit)
            output = { asset: createFrame(resized) }
            }
          } else if (nodeType === 'output' || nodeType === 'output-image') {
            // Output node: pass through inputs
            const firstInput = Object.values(inputs)[0] as ImageFrame | undefined
            if (!firstInput) throw new Error('No input to output node')
            output = { asset: firstInput }
          } else if (nodeType === 'output-data') {
            const dataInput = inputs.data
            if (dataInput === undefined) throw new Error('No data input to output node')
            output = { data: dataInput }
          } else {
            // Processing node
            const executor = executors[nodeType]
            if (!executor) throw new Error(`No executor for node type: ${nodeType}`)
            const hasInputs = Object.keys(inputs).length > 0
            if (!hasInputs) throw new Error('No input image')
            // Create per-node context with correct nodeId in progress callback
            const nodeCtx: ExecutionContext = {
              ...ctx,
              onProgress: (_id, progress) => ctx.onProgress(nodeId, progress),
              onStatus: (_id, status, error) => ctx.onStatus(nodeId, status, error),
              onStatusMessage: (_id, message) => ctx.onStatusMessage?.(nodeId, message),
              onDownloadProgress: (_id, progress) => ctx.onDownloadProgress?.(nodeId, progress),
            }
            output = await executor(nodeCtx, inputs, params)
          }

          console.log(`[pipeline] node ${nodeId} (${nodeType}) done`)
          store.updateNodeState(nodeId, {
            status: 'done',
            progress: 1,
            statusMessage: null,
            downloadProgress: null,
            output,
            cacheKey,
            error: null,
          })
        } catch (e: any) {
          if (e.name === 'AbortError' || abortController.signal.aborted) break
          console.error(`[pipeline] node ${nodeId} (${nodeType}) error:`, e)
          store.updateNodeState(nodeId, {
            status: 'error',
            error: e.message || 'Unknown error',
          })
        }
      }
    } finally {
      store.isRunning = false
      store.abortController = null
    }
  }

  function stop() {
    store.abortController?.abort()
  }

  return { run, stop, runError }
}
