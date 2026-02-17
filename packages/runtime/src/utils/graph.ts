import type { NodeDef, EdgeDef, NodeType } from '../types/pipeline'
import { getHandleDefs } from '../registry'

export interface ValidationError {
  nodeId?: string
  message: string
}

/** Kahn's algorithm topological sort. Returns ordered node IDs or throws on cycle. */
export function topoSort(nodes: NodeDef[], edges: EdgeDef[]): string[] {
  const nodeIds = new Set(nodes.map(n => n.id))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const id of nodeIds) {
    inDegree.set(id, 0)
    adjacency.set(id, [])
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    adjacency.get(edge.source)!.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const sorted: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    sorted.push(current)
    for (const neighbor of adjacency.get(current) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) queue.push(neighbor)
    }
  }

  if (sorted.length !== nodeIds.size) {
    throw new Error('Pipeline contains a cycle')
  }

  return sorted
}

/** DFS-based cycle detection. Returns true if a cycle exists. */
export function hasCycle(nodes: NodeDef[], edges: EdgeDef[]): boolean {
  try {
    topoSort(nodes, edges)
    return false
  } catch {
    return true
  }
}

/** Validate the pipeline and return any errors. */
export function validatePipeline(nodes: NodeDef[], edges: EdgeDef[]): ValidationError[] {
  const errors: ValidationError[] = []

  const inputNodes = nodes.filter(n => n.type === 'input')
  const outputNodes = nodes.filter(n => n.type === 'output')

  if (inputNodes.length === 0) {
    errors.push({ message: 'Pipeline needs at least one Input node' })
  }
  if (outputNodes.length === 0) {
    errors.push({ message: 'Pipeline needs at least one Output node' })
  }

  if (hasCycle(nodes, edges)) {
    errors.push({ message: 'Pipeline contains a cycle' })
  }

  // Check for disconnected processing nodes
  const targetIds = new Set(edges.map(e => e.target))
  const sourceIds = new Set(edges.map(e => e.source))
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  for (const node of nodes) {
    if (node.type === 'input' && !sourceIds.has(node.id)) {
      // Unconnected input nodes are OK — just skip them during execution
      continue
    }
    if (node.type === 'output' && !targetIds.has(node.id)) {
      errors.push({ nodeId: node.id, message: `Output node "${node.id}" has no incoming connection` })
    }
    if (node.type !== 'input' && node.type !== 'output') {
      if (!targetIds.has(node.id)) {
        errors.push({ nodeId: node.id, message: `Node "${node.id}" has no input connection` })
      }
      if (!sourceIds.has(node.id)) {
        errors.push({ nodeId: node.id, message: `Node "${node.id}" has no output connection` })
      }
    }
  }

  // Check handle data type compatibility
  for (const edge of edges) {
    const srcNode = nodeMap.get(edge.source)
    const tgtNode = nodeMap.get(edge.target)
    if (!srcNode || !tgtNode) continue

    const srcDefs = getHandleDefs(srcNode.type as NodeType)
    const tgtDefs = getHandleDefs(tgtNode.type as NodeType)

    const srcHandle = srcDefs.sources.find(h => h.id === edge.sourceHandle)
    const tgtHandle = tgtDefs.targets.find(h => h.id === edge.targetHandle)

    if (srcHandle && tgtHandle && srcHandle.dataType !== tgtHandle.dataType) {
      errors.push({
        message: `Incompatible connection: ${srcNode.type}.${edge.sourceHandle} (${srcHandle.dataType}) → ${tgtNode.type}.${edge.targetHandle} (${tgtHandle.dataType})`,
      })
    }
  }

  // Check multi-connection constraints: non-multi target handles should have at most 1 connection
  const targetHandleCount = new Map<string, number>()
  for (const edge of edges) {
    const key = `${edge.target}:${edge.targetHandle}`
    targetHandleCount.set(key, (targetHandleCount.get(key) || 0) + 1)
  }
  for (const [key, count] of targetHandleCount) {
    if (count <= 1) continue
    const [nodeId, handleId] = key.split(':')
    const node = nodeMap.get(nodeId)
    if (!node) continue
    const defs = getHandleDefs(node.type as NodeType)
    const handleDef = defs.targets.find(h => h.id === handleId)
    if (handleDef && !handleDef.multi) {
      errors.push({
        nodeId,
        message: `Handle "${handleId}" on node "${nodeId}" does not accept multiple connections`,
      })
    }
  }

  return errors
}

/** Get upstream node IDs for a given node. */
export function getUpstreamNodes(nodeId: string, edges: EdgeDef[]): string[] {
  return edges.filter(e => e.target === nodeId).map(e => e.source)
}

/** Get all edges targeting a given node. */
export function getUpstreamEdges(nodeId: string, edges: EdgeDef[]): EdgeDef[] {
  return edges.filter(e => e.target === nodeId)
}

/** Get all downstream node IDs (transitive) for a given node. */
export function getDownstreamNodes(nodeId: string, edges: EdgeDef[]): string[] {
  const result: string[] = []
  const visited = new Set<string>()
  const queue = edges.filter(e => e.source === nodeId).map(e => e.target)

  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    result.push(id)
    for (const edge of edges) {
      if (edge.source === id) queue.push(edge.target)
    }
  }

  return result
}
