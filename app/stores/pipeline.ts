import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Node, Edge } from '@vue-flow/core'
import { nanoid } from 'nanoid'
import type { PipelineDefinition, NodeType, NodeDef, EdgeDef } from '~~/shared/types/pipeline'
import type { NodeState, NodeOutput } from '~~/shared/types/execution'
import { createDefaultNodeState } from '~~/shared/types/execution'
import { DEFAULT_PARAMS, type NodeParamsMap } from '~~/shared/types/node-params'
import type { ImageFrame } from '~~/shared/types/image-frame'
import { getDownstreamNodes } from 'pipemagic'

const STORAGE_KEY = 'pipemagic:pipeline'

export const usePipelineStore = defineStore('pipeline', () => {
  // Vue Flow graph state
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])

  // Selection
  const selectedNodeId = ref<string | null>(null)
  const selectedEdgeId = ref<string | null>(null)

  // Execution state
  const isRunning = ref(false)
  const hasRun = ref(false)
  const nodeStates = ref<Map<string, NodeState>>(new Map())
  const abortController = ref<AbortController | null>(null)

  // Input images (stored by input node ID)
  const inputImages = ref<Map<string, ImageFrame>>(new Map())

  // File handle for "Save" vs "Save As"
  const fileHandle = ref<FileSystemFileHandle | null>(null)
  const fileName = ref<string | null>(null)
  const isDirty = ref(false)

  // Incremented on bulk pipeline loads (presets, file open, default) to signal fitView
  const pipelineLoadCount = ref(0)

  // Computed
  const selectedNode = computed(() =>
    nodes.value.find(n => n.id === selectedNodeId.value) || null,
  )

  const selectedNodeState = computed(() =>
    selectedNodeId.value ? nodeStates.value.get(selectedNodeId.value) || null : null,
  )

  const outputNode = computed(() =>
    nodes.value.find(n => n.type === 'output') || null,
  )

  const outputImage = computed<ImageFrame | null>(() => {
    const out = outputNode.value
    if (!out) return null
    return nodeStates.value.get(out.id)?.output?.asset || null
  })

  // Actions
  function selectNode(nodeId: string | null) {
    selectedNodeId.value = nodeId
    if (nodeId) selectedEdgeId.value = null
  }

  function selectEdge(edgeId: string | null) {
    // Sync Vue Flow's selected state on edge objects
    for (const e of edges.value) {
      e.selected = e.id === edgeId
    }
    selectedEdgeId.value = edgeId
    if (edgeId) selectedNodeId.value = null
  }

  function removeEdge(edgeId: string) {
    const edge = edges.value.find(e => e.id === edgeId)
    if (!edge) return
    edges.value = edges.value.filter(e => e.id !== edgeId)
    if (selectedEdgeId.value === edgeId) selectedEdgeId.value = null
    isDirty.value = true
    invalidateNode(edge.target)
    invalidateDownstream(edge.target)
  }

  function getNodeState(nodeId: string): NodeState {
    if (!nodeStates.value.has(nodeId)) {
      nodeStates.value.set(nodeId, createDefaultNodeState())
    }
    return nodeStates.value.get(nodeId)!
  }

  function updateNodeState(nodeId: string, update: Partial<NodeState>) {
    const state = getNodeState(nodeId)
    Object.assign(state, update)
    // Trigger reactivity
    nodeStates.value = new Map(nodeStates.value)
  }

  function invalidateNode(id: string) {
    const state = getNodeState(id)
    state.cacheKey = null
    state.status = 'idle'
    state.output = null
  }

  function invalidateDownstream(nodeId: string) {
    const edgeDefs = edges.value.map(e => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle || 'asset',
      target: e.target,
      targetHandle: e.targetHandle || 'asset',
    })) as EdgeDef[]
    for (const id of getDownstreamNodes(nodeId, edgeDefs)) {
      invalidateNode(id)
    }
  }

  function updateNodeParams(nodeId: string, params: Record<string, unknown>) {
    const node = nodes.value.find(n => n.id === nodeId)
    if (node) {
      node.data = { ...node.data, params: { ...node.data.params, ...params } }
      isDirty.value = true
      invalidateNode(nodeId)
      invalidateDownstream(nodeId)
      nodeStates.value = new Map(nodeStates.value)
    }
  }

  function setInputImage(nodeId: string, frame: ImageFrame) {
    inputImages.value.set(nodeId, frame)
    inputImages.value = new Map(inputImages.value)
    isDirty.value = true
    invalidateDownstream(nodeId)
    updateNodeState(nodeId, { output: { asset: frame }, status: 'done', cacheKey: null })
  }

  function addNode(type: NodeType, position: { x: number; y: number }) {
    const id = nanoid(8)
    const params = { ...(DEFAULT_PARAMS[type] as unknown as Record<string, unknown>) }
    const labels: Record<NodeType, string> = {
      'input': 'Image Input',
      'output': 'Output',
      'remove-bg': 'Remove BG',
      'normalize': 'Normalize',
      'upscale': 'Upscale 2x',
      'outline': 'Outline',
      'depth': 'Estimate Depth',
      'face-parse': 'Face Parse',
      'spritesheet': 'Spritesheet',
    }

    nodes.value.push({
      id,
      type,
      position,
      label: labels[type],
      data: { params },
    } as Node)

    isDirty.value = true
    selectedNodeId.value = id
    return id
  }

  function removeNode(nodeId: string) {
    const node = nodes.value.find(n => n.id === nodeId)
    if (!node) return
    // Prevent deleting the last input or last output node
    if (node.type === 'input' && nodes.value.filter(n => n.type === 'input').length <= 1) return
    if (node.type === 'output' && nodes.value.filter(n => n.type === 'output').length <= 1) return

    nodes.value = nodes.value.filter(n => n.id !== nodeId)
    edges.value = edges.value.filter(e => e.source !== nodeId && e.target !== nodeId)
    nodeStates.value.delete(nodeId)
    nodeStates.value = new Map(nodeStates.value)

    if (selectedNodeId.value === nodeId) {
      selectedNodeId.value = null
    }
    isDirty.value = true
  }

  function clearExecution() {
    for (const [id] of nodeStates.value) {
      nodeStates.value.set(id, createDefaultNodeState())
    }
    nodeStates.value = new Map(nodeStates.value)
    // Preserve input images
    for (const [id, frame] of inputImages.value) {
      updateNodeState(id, { output: { asset: frame }, status: 'done' })
    }
  }

  function loadDefaultPipeline() {
    const inputId = nanoid(8)
    const removeBgId = nanoid(8)
    const normalizeId = nanoid(8)
    const outlineId = nanoid(8)
    const upscaleId = nanoid(8)
    const outputId = nanoid(8)

    nodes.value = [
      {
        id: inputId,
        type: 'input',
        position: { x: 60, y: 180 },
        label: 'Image Input',
        data: { params: { maxSize: 2048, fit: 'contain' } },
      },
      {
        id: removeBgId,
        type: 'remove-bg',
        position: { x: 380, y: 180 },
        label: 'Remove BG',
        data: { params: { device: 'auto', dtype: 'fp16' } },
      },
      {
        id: normalizeId,
        type: 'normalize',
        position: { x: 680, y: 180 },
        label: 'Normalize',
        data: { params: { size: 2048, padding: 160 } },
      },
      {
        id: outlineId,
        type: 'outline',
        position: { x: 940, y: 200 },
        label: 'Outline',
        data: { params: { thickness: 50, color: '#ffffff', opacity: 1, quality: 'high', position: 'outside', threshold: 5 } },
      },
      {
        id: upscaleId,
        type: 'upscale',
        position: { x: 1220, y: 200 },
        label: 'Upscale 2x',
        data: { params: { model: 'cnn-2x-l', contentType: 'rl' } },
      },
      {
        id: outputId,
        type: 'output',
        position: { x: 1500, y: 180 },
        label: 'Output',
        data: { params: { format: 'png', quality: 0.92 } },
      },
    ] as Node[]

    edges.value = [
      { id: nanoid(8), source: inputId, target: removeBgId, sourceHandle: 'asset', targetHandle: 'asset' },
      { id: nanoid(8), source: removeBgId, target: normalizeId, sourceHandle: 'asset', targetHandle: 'asset' },
      { id: nanoid(8), source: normalizeId, target: outlineId, sourceHandle: 'asset', targetHandle: 'asset' },
      { id: nanoid(8), source: outlineId, target: upscaleId, sourceHandle: 'asset', targetHandle: 'asset' },
      { id: nanoid(8), source: upscaleId, target: outputId, sourceHandle: 'asset', targetHandle: 'asset' },
    ] as Edge[]

    nodeStates.value = new Map()
    inputImages.value = new Map()
    fileHandle.value = null
    fileName.value = null
    isDirty.value = false
    selectedNodeId.value = null
    selectedEdgeId.value = null
    pipelineLoadCount.value++
  }

  function serializePipeline(): PipelineDefinition {
    return {
      version: 2,
      nodes: nodes.value.map(n => ({
        id: n.id,
        type: n.type as NodeType,
        position: { x: n.position.x, y: n.position.y },
        params: n.data?.params || {},
        label: (n.label as string) || undefined,
      })),
      edges: edges.value.map(e => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourceHandle || 'asset',
        target: e.target,
        targetHandle: e.targetHandle || 'asset',
      })),
    }
  }

  function loadPipeline(def: PipelineDefinition) {
    // Preserve input images: grab the first existing input image
    const previousImage = inputImages.value.values().next().value as ImageFrame | undefined

    nodes.value = def.nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      label: n.label || n.type,
      data: { params: n.params },
    })) as Node[]

    // Migrate v1 handle names: "output" → "asset", "input" → "asset"
    edges.value = def.edges.map(e => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourceHandle === 'output' ? 'asset' : e.sourceHandle,
      target: e.target,
      targetHandle: e.targetHandle === 'input' ? 'asset' : e.targetHandle,
    })) as Edge[]

    nodeStates.value = new Map()
    inputImages.value = new Map()

    // Re-assign the previous input image to the new input node(s)
    if (previousImage) {
      for (const node of def.nodes) {
        if (node.type === 'input') {
          inputImages.value.set(node.id, previousImage)
          nodeStates.value.set(node.id, {
            ...createDefaultNodeState(),
            output: { asset: previousImage },
            status: 'done',
          })
        }
      }
      inputImages.value = new Map(inputImages.value)
      nodeStates.value = new Map(nodeStates.value)
    }

    isDirty.value = false
    selectedNodeId.value = null
    selectedEdgeId.value = null
    pipelineLoadCount.value++
  }

  // Persist pipeline to localStorage
  function saveToStorage() {
    if (import.meta.client && nodes.value.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializePipeline()))
    }
  }

  function restoreFromStorage(): boolean {
    if (!import.meta.client) return false
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      const def = JSON.parse(raw) as PipelineDefinition
      if (def.nodes?.length > 0) {
        loadPipeline(def)
        return true
      }
    } catch { /* ignore corrupt data */ }
    return false
  }

  // Auto-save on any node/edge/param change
  watch([nodes, edges], saveToStorage, { deep: true })

  return {
    // State
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    isRunning,
    hasRun,
    nodeStates,
    abortController,
    inputImages,
    fileHandle,
    fileName,
    isDirty,
    pipelineLoadCount,
    // Computed
    selectedNode,
    selectedNodeState,
    outputNode,
    outputImage,
    // Actions
    selectNode,
    selectEdge,
    removeEdge,
    getNodeState,
    updateNodeState,
    updateNodeParams,
    setInputImage,
    addNode,
    removeNode,
    clearExecution,
    loadDefaultPipeline,
    serializePipeline,
    loadPipeline,
    restoreFromStorage,
  }
})
