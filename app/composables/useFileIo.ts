import { nanoid } from 'nanoid'
import { usePipelineStore } from '~/stores/pipeline'
import type { PipelineDefinition } from '~~/shared/types/pipeline'

const filePickerOptions = {
  types: [
    {
      description: 'PipeMagic',
      accept: { 'application/json': ['.imgpipe.json'] },
    },
  ],
}

export function useFileIo() {
  const store = usePipelineStore()

  async function savePipeline() {
    if (store.fileHandle) {
      await writeToHandle(store.fileHandle)
    } else {
      await savePipelineAs()
    }
  }

  async function savePipelineAs() {
    const json = JSON.stringify(store.serializePipeline(), null, 2)

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          ...filePickerOptions,
          suggestedName: 'pipeline.imgpipe.json',
        })
        store.fileHandle = handle
        store.fileName = handle.name
        await writeToHandle(handle)
        store.isDirty = false
        return
      } catch (e: any) {
        if (e.name === 'AbortError') return
      }
    }

    // Fallback: download link
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pipeline.imgpipe.json'
    a.click()
    URL.revokeObjectURL(url)
    store.isDirty = false
  }

  async function writeToHandle(handle: FileSystemFileHandle) {
    const json = JSON.stringify(store.serializePipeline(), null, 2)
    const writable = await handle.createWritable()
    await writable.write(json)
    await writable.close()
    store.isDirty = false
  }

  async function openPipeline() {
    if (store.isDirty) {
      const ok = confirm('You have unsaved changes. Discard them?')
      if (!ok) return
    }

    let json: string

    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          ...filePickerOptions,
          multiple: false,
        })
        const file = await handle.getFile()
        json = await file.text()
        store.fileHandle = handle
        store.fileName = handle.name
      } catch (e: any) {
        if (e.name === 'AbortError') return
        throw e
      }
    } else {
      // Fallback: file input
      json = await new Promise<string>((resolve, reject) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json,.imgpipe.json'
        input.onchange = async () => {
          const file = input.files?.[0]
          if (!file) return reject(new Error('No file selected'))
          const text = await file.text()
          store.fileName = file.name
          resolve(text)
        }
        input.click()
      })
    }

    try {
      const def = JSON.parse(json) as PipelineDefinition
      if ((def.version !== 1 && def.version !== 2) || !Array.isArray(def.nodes) || !Array.isArray(def.edges)) {
        throw new Error('Invalid pipeline file format')
      }
      store.loadPipeline(def)
    } catch (e: any) {
      alert(`Failed to load pipeline: ${e.message}`)
    }
  }

  function newPipeline() {
    if (store.isDirty) {
      const ok = confirm('You have unsaved changes. Discard them?')
      if (!ok) return
    }
    const inputId = nanoid(8)
    const outputId = nanoid(8)
    store.loadPipeline({
      version: 2,
      nodes: [
        { id: inputId, type: 'input', position: { x: 100, y: 200 }, params: { maxSize: 2048, fit: 'contain' }, label: 'Image Input' },
        { id: outputId, type: 'output', position: { x: 500, y: 200 }, params: { format: 'png', quality: 0.92 }, label: 'Output' },
      ],
      edges: [
        { id: nanoid(8), source: inputId, sourceHandle: 'asset', target: outputId, targetHandle: 'asset' },
      ],
    })
    store.fileHandle = null
    store.fileName = null
  }

  return { savePipeline, savePipelineAs, openPipeline, newPipeline }
}
