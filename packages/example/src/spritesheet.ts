import { PipeMagic } from 'pipemagic'
import type { NodeStatus, PipelineDefinition } from 'pipemagic'

export const CODE = `import { PipeMagic } from 'pipemagic'

// Define a multi-input spritesheet pipeline
const pipeline = {
  version: 2,
  nodes: [
    { id: 'in1',   type: 'input',        label: 'Image 1', isDefault: true,
      params: { maxSize: 2048, fit: 'contain' } },
    { id: 'in2',   type: 'input',        label: 'Image 2' },
    { id: 'in3',   type: 'input',        label: 'Image 3' },
    { id: 'in4',   type: 'input',        label: 'Image 4' },
    { id: 'sheet', type: 'spritesheet',
      params: { columns: 'auto', rows: 'auto', gap: 0, bgColor: 'transparent' } },
    { id: 'out',   type: 'output-image', label: 'Output', isDefault: true,
      params: { format: 'png', quality: 0.92 } },
    { id: 'data',  type: 'output-data',  label: 'Data Output' },
  ],
  edges: [
    { source: 'in1',   target: 'sheet', targetHandle: 'images' },
    { source: 'in2',   target: 'sheet', targetHandle: 'images' },
    { source: 'in3',   target: 'sheet', targetHandle: 'images' },
    { source: 'in4',   target: 'sheet', targetHandle: 'images' },
    { source: 'sheet', sourceHandle: 'asset', target: 'out' },
    { source: 'sheet', sourceHandle: 'data',  target: 'data' },
  ],
}

const pm = new PipeMagic()

// Multi-input: pass a Record<label, ImageBitmap>
const bitmaps: Record<string, ImageBitmap> = {
  'Image 1': await createImageBitmap(file1),
  'Image 2': await createImageBitmap(file2),
  'Image 3': await createImageBitmap(file3),
  'Image 4': await createImageBitmap(file4),
}

const result = await pm.run(pipeline, bitmaps, {
  onNodeProgress(nodeId, progress) { /* ... */ },
  onNodeStatus(nodeId, status) { /* ... */ },
})

// Image output
console.log(result.blob)   // spritesheet PNG Blob
console.log(result.width)  // spritesheet width
console.log(result.height) // spritesheet height

// Named outputs (by label)
const dataOut = result.outputs['Data Output']
console.log(dataOut.data)  // { frames: [...], width, height }
`

const spritesheetPipeline: PipelineDefinition = {
  version: 2,
  nodes: [
    { id: '2vk1RDGz', type: 'input', position: { x: 100, y: 140 }, params: { maxSize: 2048, fit: 'contain' }, label: 'Image Input', isDefault: true },
    { id: 'Shel0Vgs', type: 'output-image', position: { x: 820, y: 180 }, params: { format: 'png', quality: 0.92 }, label: 'Output', isDefault: true },
    { id: '_Btx5Clj', type: 'output-data', position: { x: 820, y: 520 }, params: {}, label: 'Data Output', isDefault: false },
    { id: 'H_PNvlk-', type: 'spritesheet', position: { x: 420, y: 280 }, params: { columns: 'auto', rows: 'auto', gap: 0, bgColor: 'transparent' }, label: 'Spritesheet', isDefault: false },
    { id: '-5RLWAiz', type: 'input', position: { x: -160, y: 420 }, params: { maxSize: 2048, fit: 'contain' }, label: 'Image Input 2', isDefault: false },
    { id: 'FjaM2Brl', type: 'input', position: { x: 80, y: 560 }, params: { maxSize: 2048, fit: 'contain' }, label: 'Image Input 3', isDefault: false },
    { id: 'OoA-nfuE', type: 'input', position: { x: -160, y: 860 }, params: { maxSize: 2048, fit: 'contain' }, label: 'Image Input 4', isDefault: false },
  ],
  edges: [
    { id: 'Nq757rLk', source: '2vk1RDGz', sourceHandle: 'asset', target: 'H_PNvlk-', targetHandle: 'images' },
    { id: 'YbvYnK0s', source: 'H_PNvlk-', sourceHandle: 'asset', target: 'Shel0Vgs', targetHandle: 'asset' },
    { id: 'rd3lap_o', source: 'H_PNvlk-', sourceHandle: 'data', target: '_Btx5Clj', targetHandle: 'data' },
    { id: 'j1G5E-RA', source: '-5RLWAiz', sourceHandle: 'asset', target: 'H_PNvlk-', targetHandle: 'images' },
    { id: 'e8RC0exZ', source: 'FjaM2Brl', sourceHandle: 'asset', target: 'H_PNvlk-', targetHandle: 'images' },
    { id: 'B4rH9Ck2', source: 'OoA-nfuE', sourceHandle: 'asset', target: 'H_PNvlk-', targetHandle: 'images' },
  ],
}

const INPUT_LABELS = ['Image Input', 'Image Input 2', 'Image Input 3', 'Image Input 4']

export function initSpritesheet(container: HTMLElement) {
  container.innerHTML = `
    <p class="subtitle">Drop an image into each slot (up to 4). Empty slots fall back to the first image.</p>
    <div class="slots">
      <div class="slot" data-slot="0"><span class="slot-label">Image Input 1</span></div>
      <div class="slot" data-slot="1"><span class="slot-label">Image Input 2</span></div>
      <div class="slot" data-slot="2"><span class="slot-label">Image Input 3</span></div>
      <div class="slot" data-slot="3"><span class="slot-label">Image Input 4</span></div>
    </div>
    <input type="file" class="fi" data-idx="0" accept="image/*" hidden>
    <input type="file" class="fi" data-idx="1" accept="image/*" hidden>
    <input type="file" class="fi" data-idx="2" accept="image/*" hidden>
    <input type="file" class="fi" data-idx="3" accept="image/*" hidden>
    <button class="btn-primary run-btn" style="margin-top:12px">Run Spritesheet</button>
    <div class="progress-area"></div>
    <div class="error-msg"></div>
    <div class="sprite-result">
      <div class="panel">
        <h2>Spritesheet Image</h2>
        <img class="result-img" alt="Spritesheet result">
        <br>
        <button class="btn-primary download-btn" style="margin-top:0.75rem">Download PNG</button>
      </div>
      <div class="panel">
        <h2>Data Output</h2>
        <pre class="data-json"></pre>
        <button class="btn-primary download-json-btn" style="margin-top:0.75rem">Download JSON</button>
      </div>
    </div>
  `

  const slotEls = [...container.querySelectorAll<HTMLElement>('.slot')]
  const fileInputs = [...container.querySelectorAll<HTMLInputElement>('.fi')]
  const runBtn = container.querySelector<HTMLButtonElement>('.run-btn')!
  const progressArea = container.querySelector<HTMLElement>('.progress-area')!
  const resultArea = container.querySelector<HTMLElement>('.sprite-result')!
  const resultImg = container.querySelector<HTMLImageElement>('.result-img')!
  const dataPre = container.querySelector<HTMLElement>('.data-json')!
  const downloadBtn = container.querySelector<HTMLElement>('.download-btn')!
  const downloadJsonBtn = container.querySelector<HTMLElement>('.download-json-btn')!
  const errorMsg = container.querySelector<HTMLElement>('.error-msg')!

  let resultBlob: Blob | null = null
  let resultData: unknown = null
  const pm = new PipeMagic()
  const slotFiles: Array<File | null> = [null, null, null, null]
  const slotUrls: Array<string | null> = [null, null, null, null]
  const nodeProgress = new Map<string, { bar: HTMLDivElement; status: HTMLDivElement; message: HTMLDivElement }>()

  function initProgressUI() {
    progressArea.innerHTML = ''
    nodeProgress.clear()
    for (const node of spritesheetPipeline.nodes) {
      if (node.type === 'input' || node.type === 'output-image' || node.type === 'output-data' || node.type === 'output') continue
      const row = document.createElement('div')
      row.className = 'node-row'
      const name = document.createElement('div')
      name.className = 'node-name'
      name.textContent = node.label || node.id
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
    ui.bar.className = `node-bar${statusClass ? ` ${statusClass}` : ''}`
    ui.status.textContent = statusText
  }

  function setNodeMessage(nodeId: string, msg: string | null) {
    const ui = nodeProgress.get(nodeId)
    if (!ui) return
    ui.message.textContent = msg || ''
  }

  function buildInputRecord(): Record<string, File> {
    const first = slotFiles.find((f): f is File => f instanceof File)
    if (!first) throw new Error('Please add at least one image.')
    const out: Record<string, File> = {}
    for (let i = 0; i < INPUT_LABELS.length; i++) {
      const candidate = slotFiles[i]
      out[INPUT_LABELS[i]] = candidate instanceof File ? candidate : first
    }
    return out
  }

  async function buildBitmapRecord(): Promise<Record<string, ImageBitmap>> {
    const files = buildInputRecord()
    const entries = await Promise.all(
      Object.entries(files).map(async ([label, file]) => {
        const bitmap = await createImageBitmap(file)
        return [label, bitmap] as const
      }),
    )
    return Object.fromEntries(entries)
  }

  function renderSlotPreview(index: number, file: File | null) {
    const slot = slotEls[index]
    if (!slot) return
    if (slotUrls[index]) { URL.revokeObjectURL(slotUrls[index]!); slotUrls[index] = null }
    if (file) {
      const url = URL.createObjectURL(file)
      slotUrls[index] = url
      slot.innerHTML = `<img src="${url}" alt="Input ${index + 1}">`
    } else {
      slot.innerHTML = `<span class="slot-label">Image Input ${index + 1}</span>`
    }
  }

  async function runSpritesheet() {
    resultArea.classList.remove('active')
    errorMsg.classList.remove('active')
    progressArea.classList.add('active')
    initProgressUI()
    resultBlob = null
    dataPre.textContent = ''

    try {
      const bitmapRecord = await buildBitmapRecord()
      const result = await pm.run(spritesheetPipeline, bitmapRecord, {
        onNodeProgress(nodeId, progress) { updateNodeUI(nodeId, `${Math.round(progress * 100)}%`, progress) },
        onNodeStatus(nodeId, status: NodeStatus, error?: string) {
          if (status === 'running') updateNodeUI(nodeId, 'Running', 0)
          if (status === 'done') { updateNodeUI(nodeId, 'Done', 1, 'done'); setNodeMessage(nodeId, null) }
          if (status === 'error') { updateNodeUI(nodeId, 'Error', 1, 'error'); setNodeMessage(nodeId, error || 'Unknown error') }
        },
        onNodeStatusMessage(nodeId, message) { setNodeMessage(nodeId, message) },
        onNodeDownloadProgress(nodeId, progress) {
          if (progress != null) setNodeMessage(nodeId, `Downloading model: ${Math.round(progress * 100)}%`)
        },
      })

      const imageOut = result.outputs['Output']
      const dataOut = result.outputs['Data Output']
      const finalBlob = imageOut?.asset || result.blob
      resultBlob = finalBlob
      resultImg.src = URL.createObjectURL(finalBlob)
      resultData = dataOut?.data ?? null
      dataPre.textContent = JSON.stringify(resultData, null, 2)
      resultArea.classList.add('active')
    } catch (e: any) {
      if (e.name === 'AbortError') return
      errorMsg.textContent = `Error: ${e.message}`
      errorMsg.classList.add('active')
      console.error('Spritesheet error:', e)
    }
  }

  function bindSlot(index: number) {
    const slot = slotEls[index]
    const input = fileInputs[index]
    if (!slot || !input) return
    slot.addEventListener('click', () => input.click())
    slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('dragover') })
    slot.addEventListener('dragleave', () => slot.classList.remove('dragover'))
    slot.addEventListener('drop', (e) => {
      e.preventDefault()
      slot.classList.remove('dragover')
      const file = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/'))
      if (!file) return
      slotFiles[index] = file
      renderSlotPreview(index, file)
    })
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file || !file.type.startsWith('image/')) return
      slotFiles[index] = file
      renderSlotPreview(index, file)
      input.value = ''
    })
  }

  for (let i = 0; i < 4; i++) { bindSlot(i); renderSlotPreview(i, null) }

  runBtn.addEventListener('click', () => runSpritesheet())
  downloadBtn.addEventListener('click', () => {
    if (!resultBlob) return
    const url = URL.createObjectURL(resultBlob)
    const a = document.createElement('a')
    a.href = url; a.download = 'spritesheet.png'; a.click()
    URL.revokeObjectURL(url)
  })
  downloadJsonBtn.addEventListener('click', () => {
    if (resultData == null) return
    const blob = new Blob([JSON.stringify(resultData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'spritesheet.json'; a.click()
    URL.revokeObjectURL(url)
  })
}
