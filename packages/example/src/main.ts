import type { PipelineDefinition } from 'pipemagic'
import { initSticker, CODE as STICKER_CODE, stickerPipeline } from './sticker'
import { initSpritesheet, CODE as SPRITESHEET_CODE, spritesheetPipeline } from './spritesheet'

declare const hljs: { highlightElement(el: HTMLElement): void }

if (import.meta.env.VITE_PLAUSIBLE_SRC) {
  const s = document.createElement('script')
  s.defer = true
  s.src = import.meta.env.VITE_PLAUSIBLE_SRC
  document.head.appendChild(s)
}

const tabs = document.querySelectorAll<HTMLButtonElement>('.tab-btn')
const panels = document.querySelectorAll<HTMLElement>('.tab-panel')
const codeBlock = document.getElementById('code-block')!
const editorFrame = document.getElementById('editor-frame') as HTMLIFrameElement | null

const codeSnippets: Record<string, string> = {
  sticker: STICKER_CODE,
  spritesheet: SPRITESHEET_CODE,
}
const pipelineDefinitions: Record<string, PipelineDefinition> = {
  sticker: stickerPipeline,
  spritesheet: spritesheetPipeline,
}

const validTabs = Object.keys(codeSnippets)
const initialized = new Set<string>()
let activeTabId: string | null = null

const editorUrl = import.meta.env.VITE_EDITOR_URL || '/editor/'
const editorTargetOrigin = new URL(editorUrl, window.location.href).origin

function postPipelineToEditor(tabId: string) {
  const pipeline = pipelineDefinitions[tabId]
  if (!pipeline || !editorFrame?.contentWindow) return
  editorFrame.contentWindow.postMessage({ type: 'load-pipeline', pipeline }, editorTargetOrigin)
}

if (editorFrame) {
  editorFrame.src = editorUrl
  editorFrame.addEventListener('load', () => {
    if (activeTabId) postPipelineToEditor(activeTabId)
  })
}

function activateTab(tabId: string) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId))
  panels.forEach(p => p.classList.toggle('active', p.id === `panel-${tabId}`))

  const url = new URL(window.location.href)
  url.searchParams.set('example', tabId)
  history.replaceState(null, '', url)

  codeBlock.textContent = codeSnippets[tabId] || ''
  codeBlock.removeAttribute('data-highlighted')
  hljs.highlightElement(codeBlock)
  activeTabId = tabId
  postPipelineToEditor(tabId)

  if (!initialized.has(tabId)) {
    initialized.add(tabId)
    const panel = document.getElementById(`panel-${tabId}`)
    if (!panel) return
    if (tabId === 'sticker') initSticker(panel)
    else if (tabId === 'spritesheet') initSpritesheet(panel)
  }
}

tabs.forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab!))
})

const requested = new URLSearchParams(window.location.search).get('example')
activateTab(validTabs.includes(requested!) ? requested! : 'sticker')
