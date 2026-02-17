import type { HandleDef } from './types/handles'
import type { NodeType } from './types/pipeline'

export interface NodeHandleDefs {
  targets: HandleDef[]
  sources: HandleDef[]
}

const registry: Record<NodeType, NodeHandleDefs> = {
  'input': {
    targets: [],
    sources: [{ id: 'asset', direction: 'source', dataType: 'image' }],
  },
  'remove-bg': {
    targets: [{ id: 'asset', direction: 'target', dataType: 'image' }],
    sources: [{ id: 'asset', direction: 'source', dataType: 'image' }],
  },
  'normalize': {
    targets: [{ id: 'asset', direction: 'target', dataType: 'image' }],
    sources: [{ id: 'asset', direction: 'source', dataType: 'image' }],
  },
  'outline': {
    targets: [{ id: 'asset', direction: 'target', dataType: 'image' }],
    sources: [{ id: 'asset', direction: 'source', dataType: 'image' }],
  },
  'upscale': {
    targets: [{ id: 'asset', direction: 'target', dataType: 'image' }],
    sources: [{ id: 'asset', direction: 'source', dataType: 'image' }],
  },
  'depth': {
    targets: [{ id: 'asset', direction: 'target', dataType: 'image' }],
    sources: [{ id: 'asset', direction: 'source', dataType: 'image' }],
  },
  'face-parse': {
    targets: [{ id: 'asset', direction: 'target', dataType: 'image' }],
    sources: [{ id: 'asset', direction: 'source', dataType: 'image' }],
  },
  'spritesheet': {
    targets: [{ id: 'images', direction: 'target', dataType: 'image', multi: true, label: 'Images' }],
    sources: [
      { id: 'asset', direction: 'source', dataType: 'image', label: 'Sheet' },
      { id: 'data', direction: 'source', dataType: 'data', label: 'Data' },
    ],
  },
  'output': {
    targets: [
      { id: 'asset', direction: 'target', dataType: 'image' },
      { id: 'data', direction: 'target', dataType: 'data', label: 'Data' },
    ],
    sources: [],
  },
}

export function getHandleDefs(nodeType: NodeType): NodeHandleDefs {
  return registry[nodeType] ?? { targets: [], sources: [] }
}
