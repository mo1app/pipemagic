<script setup lang="ts">
import { ArrowDownTrayIcon } from '@heroicons/vue/20/solid'
import BaseNode from '~/components/nodes/BaseNode.vue'
import { usePipelineStore } from '~/stores/pipeline'
import { bitmapToBlob } from 'pipemagic'

const props = defineProps<{ id: string; label?: string; data: { params: Record<string, unknown> } }>()

const store = usePipelineStore()

const state = computed(() => store.getNodeState(props.id))

async function downloadOutput() {
  const asset = state.value.output?.asset
  if (!asset) return
  const format = (props.data.params.format as string) || 'png'
  const quality = (props.data.params.quality as number) || 0.92
  const blob = await bitmapToBlob(asset.bitmap, format as 'png' | 'jpeg' | 'webp', quality)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `output.${format}`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <BaseNode :id="id" :label="label || 'Output'" node-type="output" :icon="ArrowDownTrayIcon">
    <div class="flex items-center justify-between">
      <span class="text-gray-500 text-xs">
        {{ state.output?.asset ? `${state.output.asset.width} × ${state.output.asset.height}` : 'No output yet' }}
      </span>
      <button
        v-if="state.output?.asset"
        class="text-[10px] px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white"
        @click.stop="downloadOutput"
      >
        Download
      </button>
    </div>
  </BaseNode>
</template>
