import type { ExecutionContext } from '../types/execution'
import type { NodeOutput } from '../types/execution'
import type { ImageFrame } from '../types/image-frame'

export interface SpritesheetFrame {
  name: string
  x: number
  y: number
  w: number
  h: number
  u0: number
  v0: number
  u1: number
  v1: number
}

export interface SpritesheetData {
  frames: SpritesheetFrame[]
  width: number
  height: number
}

export async function executeSpritesheet(
  ctx: ExecutionContext,
  inputs: Record<string, ImageFrame | ImageFrame[]>,
  params: Record<string, unknown>,
): Promise<NodeOutput> {
  const images = inputs.images
  if (!images) throw new Error('No images connected to spritesheet node')

  const frames = Array.isArray(images) ? images : [images]
  if (frames.length === 0) throw new Error('No images connected to spritesheet node')

  ctx.onProgress('', 0.1)

  const columnsParam = params.columns as number | 'auto' ?? 'auto'
  const rowsParam = params.rows as number | 'auto' ?? 'auto'
  const gap = (params.gap as number) ?? 0
  const bgColor = (params.bgColor as string) ?? 'transparent'

  // Compute grid dimensions
  let columns: number
  let rows: number

  if (columnsParam !== 'auto' && rowsParam !== 'auto') {
    columns = columnsParam
    rows = rowsParam
  } else if (columnsParam !== 'auto') {
    columns = columnsParam
    rows = Math.ceil(frames.length / columns)
  } else if (rowsParam !== 'auto') {
    rows = rowsParam
    columns = Math.ceil(frames.length / rows)
  } else {
    columns = Math.ceil(Math.sqrt(frames.length))
    rows = Math.ceil(frames.length / columns)
  }

  // Uniform cell size: max width/height across all inputs
  let cellW = 0
  let cellH = 0
  for (const frame of frames) {
    if (frame.width > cellW) cellW = frame.width
    if (frame.height > cellH) cellH = frame.height
  }

  // Sheet dimensions
  const sheetW = columns * cellW + (columns - 1) * gap
  const sheetH = rows * cellH + (rows - 1) * gap

  ctx.onProgress('', 0.3)

  // Draw grid
  const canvas = new OffscreenCanvas(sheetW, sheetH)
  const drawCtx = canvas.getContext('2d')!

  if (bgColor !== 'transparent') {
    drawCtx.fillStyle = bgColor
    drawCtx.fillRect(0, 0, sheetW, sheetH)
  }

  const frameData: SpritesheetFrame[] = []

  for (let i = 0; i < frames.length; i++) {
    if (ctx.abortSignal.aborted) throw new DOMException('Aborted', 'AbortError')

    const frame = frames[i]
    if (!frame?.bitmap || !(frame.bitmap instanceof ImageBitmap)) {
      throw new Error(`spritesheet: frame ${i} has invalid bitmap (${Object.prototype.toString.call(frame?.bitmap)})`)
    }
    const col = i % columns
    const row = Math.floor(i / columns)

    const cellX = col * (cellW + gap)
    const cellY = row * (cellH + gap)

    // Center image in cell
    const offsetX = cellX + Math.floor((cellW - frame.width) / 2)
    const offsetY = cellY + Math.floor((cellH - frame.height) / 2)

    drawCtx.drawImage(frame.bitmap, offsetX, offsetY)

    frameData.push({
      name: `frame_${i}`,
      x: offsetX,
      y: offsetY,
      w: frame.width,
      h: frame.height,
      u0: offsetX / sheetW,
      v0: offsetY / sheetH,
      u1: (offsetX + frame.width) / sheetW,
      v1: (offsetY + frame.height) / sheetH,
    })

    ctx.onProgress('', 0.3 + (0.6 * (i + 1) / frames.length))
  }

  const bitmap = await createImageBitmap(canvas)
  ctx.onProgress('', 1)

  const data: SpritesheetData = {
    frames: frameData,
    width: sheetW,
    height: sheetH,
  }

  return {
    asset: {
      bitmap,
      width: sheetW,
      height: sheetH,
      revision: Date.now(),
    },
    data,
  }
}
