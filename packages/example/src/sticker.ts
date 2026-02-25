import { PipeMagic } from 'pipemagic'
import type { PipelineDefinition, NodeStatus } from 'pipemagic'

export const CODE = `import { PipeMagic } from 'pipemagic'

// Define the sticker pipeline
const pipeline = {
  version: 1,
  nodes: [
    { id: 'input',     type: 'input',     params: { maxSize: 2048, fit: 'contain' } },
    { id: 'remove-bg', type: 'remove-bg', params: { device: 'auto', dtype: 'fp16' } },
    { id: 'normalize', type: 'normalize', params: { size: 2048, padding: 160 } },
    { id: 'outline',   type: 'outline',   params: { thickness: 50, color: '#ffffff' } },
    { id: 'upscale',   type: 'upscale',   params: { model: 'cnn-2x-l' } },
    { id: 'output',    type: 'output',    params: { format: 'png', quality: 0.92 } },
  ],
  edges: [
    { source: 'input',     target: 'remove-bg' },
    { source: 'remove-bg', target: 'normalize' },
    { source: 'normalize', target: 'outline' },
    { source: 'outline',   target: 'upscale' },
    { source: 'upscale',   target: 'output' },
  ],
}

const pm = new PipeMagic()

// Run with a single image file
const result = await pm.run(pipeline, imageFile, {
  onNodeProgress(nodeId, progress) {
    console.log(nodeId, Math.round(progress * 100) + '%')
  },
  onNodeStatus(nodeId, status, error?) {
    console.log(nodeId, status, error ?? '')
  },
  onNodeStatusMessage(nodeId, message) {
    console.log(nodeId, message)
  },
  onNodeDownloadProgress(nodeId, progress) {
    if (progress != null)
      console.log(nodeId, 'downloading', Math.round(progress * 100) + '%')
  },
})

// Result
console.log(result.blob)   // PNG Blob
console.log(result.width)  // output width
console.log(result.height) // output height
`

const stickerPipeline: PipelineDefinition = {
  version: 1,
  nodes: [
    { id: 'input', type: 'input', position: { x: 0, y: 0 }, params: { maxSize: 2048, fit: 'contain' } },
    { id: 'remove-bg', type: 'remove-bg', position: { x: 1, y: 0 }, params: { device: 'auto', dtype: 'fp16' } },
    { id: 'normalize', type: 'normalize', position: { x: 2, y: 0 }, params: { size: 2048, padding: 160 } },
    { id: 'outline', type: 'outline', position: { x: 3, y: 0 }, params: { thickness: 50, color: '#ffffff', opacity: 1, quality: 'high', position: 'outside', threshold: 5 } },
    { id: 'upscale', type: 'upscale', position: { x: 4, y: 0 }, params: { model: 'cnn-2x-l', contentType: 'rl' } },
    { id: 'output', type: 'output', position: { x: 5, y: 0 }, params: { format: 'png', quality: 0.92 } },
  ],
  edges: [
    { id: 'e1', source: 'input', sourceHandle: 'output', target: 'remove-bg', targetHandle: 'input' },
    { id: 'e2', source: 'remove-bg', sourceHandle: 'output', target: 'normalize', targetHandle: 'input' },
    { id: 'e3', source: 'normalize', sourceHandle: 'output', target: 'outline', targetHandle: 'input' },
    { id: 'e4', source: 'outline', sourceHandle: 'output', target: 'upscale', targetHandle: 'input' },
    { id: 'e5', source: 'upscale', sourceHandle: 'output', target: 'output', targetHandle: 'input' },
  ],
}

const nodeLabels: Record<string, string> = {
  'input': 'Input',
  'remove-bg': 'Remove BG',
  'normalize': 'Normalize',
  'outline': 'Outline',
  'upscale': 'Upscale 2x',
  'output': 'Output',
}

export function initSticker(container: HTMLElement) {
  container.innerHTML = `
    <p class="subtitle">Drop an image to run: Remove BG &rarr; Normalize &rarr; Outline &rarr; Upscale 2x</p>
    <div class="drop-zone"><span class="drop-label">Drop image here or click to select</span></div>
    <input type="file" accept="image/*" hidden>
    <div class="progress-area"></div>
    <div class="error-msg"></div>
    <div class="sticker-result">
      <h2>Result</h2>
      <img class="result-img" alt="Pipeline result">
      <br>
      <button class="btn-primary download-btn">Download PNG</button>
    </div>
  `

  const dropZone = container.querySelector<HTMLElement>('.drop-zone')!
  const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!
  const progressArea = container.querySelector<HTMLElement>('.progress-area')!
  const resultArea = container.querySelector<HTMLElement>('.sticker-result')!
  const resultImg = container.querySelector<HTMLImageElement>('.result-img')!
  const downloadBtn = container.querySelector<HTMLElement>('.download-btn')!
  const errorMsg = container.querySelector<HTMLElement>('.error-msg')!

  let resultBlob: Blob | null = null
  const pm = new PipeMagic()
  const nodeProgress = new Map<string, { bar: HTMLDivElement; status: HTMLDivElement; message: HTMLDivElement }>()

  function initProgressUI() {
    progressArea.innerHTML = ''
    nodeProgress.clear()
    for (const node of stickerPipeline.nodes) {
      if (node.type === 'input' || node.type === 'output') continue
      const row = document.createElement('div')
      row.className = 'node-row'
      const name = document.createElement('div')
      name.className = 'node-name'
      name.textContent = nodeLabels[node.id] || node.id
      const barWrap = document.createElement('div')
      barWrap.className = 'node-bar-wrap'
      const bar = document.createElement('div')
      bar.className = 'node-bar'
      barWrap.appendChild(bar)
      const status = document.createElement('div')
      status.className = 'node-status'
      row.appendChild(name)
      row.appendChild(barWrap)
      row.appendChild(status)
      const message = document.createElement('div')
      message.className = 'node-message'
      progressArea.appendChild(row)
      progressArea.appendChild(message)
      nodeProgress.set(node.id, { bar, status, message })
    }
  }

  function updateNodeUI(nodeId: string, statusText: string, progress: number, statusClass?: string) {
    const ui = nodeProgress.get(nodeId)
    if (!ui) return
    ui.bar.style.width = `${Math.round(progress * 100)}%`
    ui.bar.className = `node-bar${statusClass ? ' ' + statusClass : ''}`
    ui.status.textContent = statusText
  }

  function setNodeMessage(nodeId: string, msg: string | null) {
    const ui = nodeProgress.get(nodeId)
    if (!ui) return
    ui.message.textContent = msg || ''
  }

  async function runPipeline(file: File) {
    const previewUrl = URL.createObjectURL(file)
    dropZone.innerHTML = `<img src="${previewUrl}" alt="Input">`
    dropZone.classList.add('has-image')
    resultArea.classList.remove('active')
    errorMsg.classList.remove('active')
    progressArea.classList.add('active')
    initProgressUI()
    resultBlob = null

    try {
      const result = await pm.run(stickerPipeline, file, {
        onNodeProgress(nodeId, progress) { updateNodeUI(nodeId, `${Math.round(progress * 100)}%`, progress) },
        onNodeStatus(nodeId, status: NodeStatus, error?: string) {
          if (status === 'running') updateNodeUI(nodeId, 'Running', 0)
          else if (status === 'done') { updateNodeUI(nodeId, 'Done', 1, 'done'); setNodeMessage(nodeId, null) }
          else if (status === 'error') { updateNodeUI(nodeId, 'Error', 1, 'error'); setNodeMessage(nodeId, error || 'Unknown error') }
        },
        onNodeStatusMessage(nodeId, message) { setNodeMessage(nodeId, message) },
        onNodeDownloadProgress(nodeId, progress) {
          if (progress != null) setNodeMessage(nodeId, `Downloading model: ${Math.round(progress * 100)}%`)
        },
      })

      resultBlob = result.blob
      resultImg.src = URL.createObjectURL(result.blob)
      resultArea.classList.add('active')
    } catch (e: any) {
      if (e.name === 'AbortError') return
      errorMsg.textContent = `Error: ${e.message}`
      errorMsg.classList.add('active')
      console.error('Pipeline error:', e)
    }
  }

  dropZone.addEventListener('click', () => fileInput.click())
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover') })
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'))
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropZone.classList.remove('dragover')
    const file = e.dataTransfer?.files[0]
    if (file?.type.startsWith('image/')) runPipeline(file)
  })
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (file) { runPipeline(file); fileInput.value = '' }
  })
  downloadBtn.addEventListener('click', () => {
    if (!resultBlob) return
    const url = URL.createObjectURL(resultBlob)
    const a = document.createElement('a')
    a.href = url; a.download = 'sticker.png'; a.click()
    URL.revokeObjectURL(url)
  })
}
