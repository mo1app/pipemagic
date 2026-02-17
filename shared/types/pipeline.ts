export type NodeType = 'input' | 'output' | 'remove-bg' | 'normalize' | 'upscale' | 'outline' | 'depth' | 'face-parse' | 'spritesheet'

export interface NodePosition {
  x: number
  y: number
}

export interface NodeDef {
  id: string
  type: NodeType
  position: NodePosition
  params: Record<string, unknown>
  label?: string
}

export interface EdgeDef {
  id: string
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}

export interface PipelineDefinition {
  version: 1 | 2
  nodes: NodeDef[]
  edges: EdgeDef[]
}
