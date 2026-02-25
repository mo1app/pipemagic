/** Create an OffscreenCanvas and draw an ImageBitmap onto it. */
export function bitmapToCanvas(bitmap: ImageBitmap): OffscreenCanvas {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  return canvas
}

/** Get ImageData from an ImageBitmap. */
export function bitmapToImageData(bitmap: ImageBitmap): ImageData {
  const canvas = bitmapToCanvas(bitmap)
  const ctx = canvas.getContext('2d')!
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
}

/** Create an ImageBitmap from ImageData. */
export async function imageDataToBitmap(imageData: ImageData): Promise<ImageBitmap> {
  return createImageBitmap(imageData)
}

/** Resize an ImageBitmap with optional fit mode. */
export async function resizeBitmap(
  bitmap: ImageBitmap,
  maxSize: number,
  fit: 'contain' | 'cover' | 'fill' = 'contain',
): Promise<ImageBitmap> {
  if (!(bitmap instanceof ImageBitmap)) {
    throw new Error(`resizeBitmap: expected ImageBitmap, got ${Object.prototype.toString.call(bitmap)}`)
  }
  let { width, height } = bitmap
  if (width <= maxSize && height <= maxSize) return bitmap

  if (fit === 'contain') {
    const scale = maxSize / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  } else if (fit === 'cover') {
    const scale = maxSize / Math.min(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  } else {
    width = maxSize
    height = maxSize
  }

  return createImageBitmap(bitmap, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' })
}

/** Convert an ImageBitmap to a Blob. */
export async function bitmapToBlob(
  bitmap: ImageBitmap,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality = 0.92,
): Promise<Blob> {
  const canvas = bitmapToCanvas(bitmap)
  const mimeType = format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp'
  return canvas.convertToBlob({ type: mimeType, quality })
}

/** Load an image file into an ImageBitmap. */
export async function fileToBitmap(file: File): Promise<ImageBitmap> {
  if (!(file instanceof Blob)) {
    throw new Error(`fileToBitmap: expected File/Blob, got ${Object.prototype.toString.call(file)}`)
  }
  return createImageBitmap(file)
}

/** Create a data URL from an ImageBitmap. */
export async function bitmapToDataUrl(
  bitmap: ImageBitmap,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality = 0.92,
): Promise<string> {
  const blob = await bitmapToBlob(bitmap, format, quality)
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
