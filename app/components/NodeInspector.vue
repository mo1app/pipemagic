<script setup lang="ts">
import { usePipelineStore } from '~/stores/pipeline'
import { bitmapToBlob } from 'pipemagic'
import type { NodeType } from '~~/shared/types/pipeline'

const store = usePipelineStore()

const node = computed(() => store.selectedNode)
const state = computed(() => store.selectedNodeState)
const params = computed(() => node.value?.data?.params as Record<string, unknown> | undefined)
const nodeType = computed(() => node.value?.type as NodeType | undefined)

// Per-node result preview
const previewUrl = ref<string | null>(null)
const isZoomed = ref(false)

watch(() => state.value?.output?.asset, async (asset) => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  if (asset?.bitmap) {
    const blob = await bitmapToBlob(asset.bitmap, 'png')
    previewUrl.value = URL.createObjectURL(blob)
  } else {
    previewUrl.value = null
  }
}, { immediate: true })

onUnmounted(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

function updateParam(key: string, value: unknown) {
  if (!node.value) return
  store.updateNodeParams(node.value.id, { [key]: value })
}

function handleColorInput(e: Event) {
  const target = e.target as HTMLInputElement
  updateParam('color', target.value)
}

const statusLabel = computed(() => {
  if (!state.value) return ''
  switch (state.value.status) {
    case 'idle': return 'Idle'
    case 'pending': return 'Pending'
    case 'running': return 'Running...'
    case 'done': return 'Complete'
    case 'cached': return 'Cached'
    case 'error': return 'Error'
    default: return ''
  }
})

const statusClass = computed(() => {
  if (!state.value) return 'text-gray-500'
  switch (state.value.status) {
    case 'running': return 'text-yellow-400'
    case 'done': case 'cached': return 'text-green-400'
    case 'error': return 'text-red-400'
    default: return 'text-gray-500'
  }
})
</script>

<template>
  <div class="flex flex-col overflow-y-auto h-full">
    <div v-if="!node" class="flex-1 flex items-center justify-center">
      <span class="text-xs text-gray-600">Select a node to inspect</span>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="p-3 border-b border-gray-800">
        <div class="text-sm font-semibold text-gray-200">{{ node.label || node.type }}</div>
        <div class="text-[10px] text-gray-500 mt-0.5">{{ node.type }} &middot; {{ node.id }}</div>
      </div>

      <!-- Node result preview -->
      <div class="p-3 border-b border-gray-800">
        <div class="cursor-zoom-in" @click="previewUrl && (isZoomed = true)">
          <img
            v-if="previewUrl"
            :src="previewUrl"
            class="w-full rounded border border-gray-700 checkerboard-bg"
            alt="Node result"
          >
          <div
            v-else
            class="w-full aspect-square rounded border border-gray-700 checkerboard-bg flex items-center justify-center"
          >
            <span class="text-[10px] text-gray-600">No output</span>
          </div>
          <div v-if="state?.output?.asset" class="text-[10px] text-gray-500 mt-1">
            {{ state.output.asset.width }} &times; {{ state.output.asset.height }}
          </div>
        </div>
      </div>

      <!-- Status -->
      <div class="px-3 py-2 border-b border-gray-800">
        <div class="flex items-center justify-between text-xs">
          <span class="text-gray-400">Status</span>
          <span :class="statusClass">{{ statusLabel }}</span>
        </div>
        <div
          v-if="state && state.status === 'running'"
          class="mt-1.5 h-1 bg-gray-800 rounded overflow-hidden"
        >
          <div
            class="h-full bg-gray-500 transition-all duration-300"
            :style="{ width: `${(state.progress || 0) * 100}%` }"
          />
        </div>
        <div v-if="state?.error" class="mt-1 text-[10px] text-red-400">
          {{ state.error }}
        </div>
        <div v-if="state?.deviceUsed" class="mt-1 text-[10px] text-gray-500">
          Device: {{ state.deviceUsed }}
        </div>
      </div>

      <!-- Data output (e.g. spritesheet UV data) -->
      <div v-if="state?.output?.data" class="p-3 border-b border-gray-800">
        <div class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-2">Data Output</div>
        <pre class="text-[10px] text-gray-400 bg-gray-800 rounded p-2 overflow-auto max-h-[200px] whitespace-pre-wrap break-all">{{ JSON.stringify(state.output.data, null, 2) }}</pre>
      </div>

      <!-- Parameters -->
      <div class="p-3 space-y-3">
        <div class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Parameters</div>

        <!-- Input node params -->
        <template v-if="nodeType === 'input' && params">
          <label class="block text-xs">
            <span class="text-gray-400">Max Size</span>
            <input
              type="range"
              :value="params.maxSize"
              min="256"
              max="4096"
              step="256"
              class="w-full mt-1"
              @input="updateParam('maxSize', +($event.target as HTMLInputElement).value)"
            >
            <span class="text-gray-500 text-[10px]">{{ params.maxSize }}px</span>
          </label>
          <label class="block text-xs">
            <span class="text-gray-400">Fit</span>
            <select
              :value="params.fit"
              class="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
              @change="updateParam('fit', ($event.target as HTMLSelectElement).value)"
            >
              <option value="contain">Contain</option>
              <option value="cover">Cover</option>
              <option value="fill">Fill</option>
            </select>
          </label>
        </template>

        <!-- Output node params -->
        <template v-if="nodeType === 'output' && params">
          <label class="block text-xs">
            <span class="text-gray-400">Format</span>
            <select
              :value="params.format"
              class="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
              @change="updateParam('format', ($event.target as HTMLSelectElement).value)"
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
          </label>
          <label v-if="params.format !== 'png'" class="block text-xs">
            <span class="text-gray-400">Quality</span>
            <input
              type="range"
              :value="params.quality"
              min="0.1"
              max="1"
              step="0.01"
              class="w-full mt-1"
              @input="updateParam('quality', +($event.target as HTMLInputElement).value)"
            >
            <span class="text-gray-500 text-[10px]">{{ ((params.quality as number) * 100).toFixed(0) }}%</span>
          </label>
        </template>

        <!-- Remove BG params -->
        <template v-if="nodeType === 'remove-bg' && params">
          <label class="block text-xs">
            <span class="text-gray-400">Model Quality</span>
            <select
              :value="params.dtype || 'q8'"
              class="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
              @change="updateParam('dtype', ($event.target as HTMLSelectElement).value)"
            >
              <option value="q8">Quantized 8-bit (~45 MB)</option>
              <option value="fp16">Half precision (~88 MB)</option>
              <option value="fp32">Full precision (~176 MB)</option>
            </select>
          </label>
          <label class="block text-xs">
            <span class="text-gray-400">Device</span>
            <select
              :value="params.device"
              class="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
              @change="updateParam('device', ($event.target as HTMLSelectElement).value)"
            >
              <option value="auto">Auto</option>
              <option value="webgpu">WebGPU</option>
              <option value="wasm">WASM</option>
            </select>
          </label>
        </template>

        <!-- Normalize params -->
        <template v-if="nodeType === 'normalize' && params">
          <label class="block text-xs">
            <span class="text-gray-400">Size</span>
            <input
              type="range"
              :value="params.size"
              min="128"
              max="4096"
              step="64"
              class="w-full mt-1"
              @input="updateParam('size', +($event.target as HTMLInputElement).value)"
            >
            <span class="text-gray-500 text-[10px]">{{ params.size }}px</span>
          </label>
          <label class="block text-xs">
            <span class="text-gray-400">Padding</span>
            <input
              type="range"
              :value="params.padding"
              min="0"
              max="256"
              step="1"
              class="w-full mt-1"
              @input="updateParam('padding', +($event.target as HTMLInputElement).value)"
            >
            <span class="text-gray-500 text-[10px]">{{ params.padding }}px</span>
          </label>
        </template>

        <!-- Upscale params -->
        <template v-if="nodeType === 'upscale' && params">
          <label class="block text-xs">
            <span class="text-gray-400">Model</span>
            <select
              :value="params.model || 'cnn-2x-s'"
              class="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
              @change="updateParam('model', ($event.target as HTMLSelectElement).value)"
            >
              <option value="cnn-2x-s">Small (~14 KB)</option>
              <option value="cnn-2x-m">Medium (~35 KB)</option>
              <option value="cnn-2x-l">Large (~114 KB)</option>
            </select>
          </label>
          <label class="block text-xs">
            <span class="text-gray-400">Content Type</span>
            <select
              :value="params.contentType || 'rl'"
              class="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
              @change="updateParam('contentType', ($event.target as HTMLSelectElement).value)"
            >
              <option value="rl">Real Life</option>
              <option value="an">Animation</option>
              <option value="3d">3D / Gaming</option>
            </select>
          </label>
        </template>

        <!-- Depth params -->
        <template v-if="nodeType === 'depth' && params">
          <label class="block text-xs">
            <span class="text-gray-400">Model</span>
            <select
              :value="params.model || 'fast'"
              class="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
              @change="updateParam('model', ($event.target as HTMLSelectElement).value)"
            >
              <option value="fast">Fast (~25 MB)</option>
              <option value="quality">Quality (~40 MB)</option>
            </select>
          </label>
          <label class="block text-xs">
            <span class="text-gray-400">Device</span>
            <select
              :value="params.device"
              class="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
              @change="updateParam('device', ($event.target as HTMLSelectElement).value)"
            >
              <option value="auto">Auto</option>
              <option value="webgpu">WebGPU</option>
              <option value="wasm">WASM</option>
            </select>
          </label>
        </template>

        <!-- Face Parse params -->
        <template v-if="nodeType === 'face-parse' && params">
          <label class="block text-xs">
            <span class="text-gray-400">Device</span>
            <select
              :value="params.device"
              class="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
              @change="updateParam('device', ($event.target as HTMLSelectElement).value)"
            >
              <option value="auto">Auto</option>
              <option value="webgpu">WebGPU</option>
              <option value="wasm">WASM</option>
            </select>
          </label>
        </template>

        <!-- Spritesheet params -->
        <template v-if="nodeType === 'spritesheet' && params">
          <label class="block text-xs">
            <span class="text-gray-400">Columns</span>
            <select
              :value="params.columns"
              class="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
              @change="updateParam('columns', ($event.target as HTMLSelectElement).value === 'auto' ? 'auto' : +($event.target as HTMLSelectElement).value)"
            >
              <option value="auto">Auto</option>
              <option v-for="n in 12" :key="n" :value="n">{{ n }}</option>
            </select>
          </label>
          <label class="block text-xs">
            <span class="text-gray-400">Rows</span>
            <select
              :value="params.rows"
              class="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
              @change="updateParam('rows', ($event.target as HTMLSelectElement).value === 'auto' ? 'auto' : +($event.target as HTMLSelectElement).value)"
            >
              <option value="auto">Auto</option>
              <option v-for="n in 12" :key="n" :value="n">{{ n }}</option>
            </select>
          </label>
          <label class="block text-xs">
            <span class="text-gray-400">Gap</span>
            <input
              type="range"
              :value="params.gap"
              min="0"
              max="64"
              step="1"
              class="w-full mt-1"
              @input="updateParam('gap', +($event.target as HTMLInputElement).value)"
            >
            <span class="text-gray-500 text-[10px]">{{ params.gap }}px</span>
          </label>
          <label class="block text-xs">
            <span class="text-gray-400">Background</span>
            <select
              :value="params.bgColor"
              class="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
              @change="updateParam('bgColor', ($event.target as HTMLSelectElement).value)"
            >
              <option value="transparent">Transparent</option>
              <option value="#000000">Black</option>
              <option value="#ffffff">White</option>
            </select>
          </label>
        </template>

        <!-- Outline params -->
        <template v-if="nodeType === 'outline' && params">
          <label class="block text-xs">
            <span class="text-gray-400">Thickness</span>
            <input
              type="range"
              :value="params.thickness"
              min="1"
              max="128"
              step="1"
              class="w-full mt-1"
              @input="updateParam('thickness', +($event.target as HTMLInputElement).value)"
            >
            <span class="text-gray-500 text-[10px]">{{ params.thickness }}px</span>
          </label>
          <label class="block text-xs">
            <span class="text-gray-400">Color</span>
            <div class="flex items-center gap-2 mt-1">
              <input
                type="color"
                :value="params.color"
                class="w-8 h-6 bg-transparent border-0 cursor-pointer"
                @input="handleColorInput"
              >
              <span class="text-gray-500 text-[10px]">{{ params.color }}</span>
            </div>
          </label>
          <label class="block text-xs">
            <span class="text-gray-400">Opacity</span>
            <input
              type="range"
              :value="params.opacity"
              min="0"
              max="1"
              step="0.01"
              class="w-full mt-1"
              @input="updateParam('opacity', +($event.target as HTMLInputElement).value)"
            >
            <span class="text-gray-500 text-[10px]">{{ ((params.opacity as number) * 100).toFixed(0) }}%</span>
          </label>
          <label class="block text-xs">
            <span class="text-gray-400">Position</span>
            <select
              :value="params.position"
              class="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
              @change="updateParam('position', ($event.target as HTMLSelectElement).value)"
            >
              <option value="outside">Outside</option>
              <option value="center">Center</option>
              <option value="inside">Inside</option>
            </select>
          </label>
          <label class="block text-xs">
            <span class="text-gray-400">Threshold</span>
            <input
              type="range"
              :value="params.threshold"
              min="-8"
              max="8"
              step="0.5"
              class="w-full mt-1"
              @input="updateParam('threshold', +($event.target as HTMLInputElement).value)"
            >
            <span class="text-gray-500 text-[10px]">{{ params.threshold }}px</span>
          </label>
          <label class="block text-xs">
            <span class="text-gray-400">Quality</span>
            <select
              :value="params.quality"
              class="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 text-xs"
              @change="updateParam('quality', ($event.target as HTMLSelectElement).value)"
            >
              <option value="low">Low (fast)</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </template>
      </div>

      <!-- Zoom overlay -->
      <Teleport to="body">
        <div
          v-if="isZoomed && previewUrl"
          class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-zoom-out"
          @click="isZoomed = false"
        >
          <img
            :src="previewUrl"
            class="max-w-[90vw] max-h-[90vh] object-contain"
            alt="Node result zoom"
          >
        </div>
      </Teleport>
    </template>
  </div>
</template>

<style scoped>
.checkerboard-bg {
  background-image:
    linear-gradient(45deg, #1a1a1a 25%, transparent 25%),
    linear-gradient(-45deg, #1a1a1a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #1a1a1a 75%),
    linear-gradient(-45deg, transparent 75%, #1a1a1a 75%);
  background-size: 12px 12px;
  background-position: 0 0, 0 6px, 6px -6px, -6px 0;
  background-color: #111;
}
</style>
