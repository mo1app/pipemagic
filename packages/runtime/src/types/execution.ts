import type { ImageFrame } from './image-frame'

export type NodeStatus = 'idle' | 'pending' | 'running' | 'done' | 'error' | 'cached'

export interface NodeOutput {
  asset: ImageFrame
  [key: string]: ImageFrame | unknown
}

export interface NodeState {
  status: NodeStatus
  progress: number
  statusMessage: string | null
  downloadProgress: number | null
  error: string | null
  output: NodeOutput | null
  cacheKey: string | null
  deviceUsed?: 'webgpu' | 'wasm' | null
}

export interface ExecutionContext {
  abortSignal: AbortSignal
  gpuDevice: GPUDevice | null
  onProgress: (nodeId: string, progress: number) => void
  onStatus: (nodeId: string, status: NodeStatus, error?: string) => void
  onStatusMessage?: (nodeId: string, message: string | null) => void
  onDownloadProgress?: (nodeId: string, progress: number | null) => void
}

export function createDefaultNodeState(): NodeState {
  return {
    status: 'idle',
    progress: 0,
    statusMessage: null,
    downloadProgress: null,
    error: null,
    output: null,
    cacheKey: null,
    deviceUsed: null,
  }
}
