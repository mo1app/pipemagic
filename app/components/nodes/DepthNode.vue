<script setup lang="ts">
import { EyeIcon } from '@heroicons/vue/20/solid'
import BaseNode from '~/components/nodes/BaseNode.vue'
import { usePipelineStore } from '~/stores/pipeline'

const props = defineProps<{ id: string; label?: string; data: { params: Record<string, unknown> } }>()

const store = usePipelineStore()
const state = computed(() => store.getNodeState(props.id))

const modelLabel = computed(() => {
  return props.data.params.model === 'quality' ? 'Quality' : 'Fast'
})
</script>

<template>
  <BaseNode :id="id" :label="label || 'Estimate Depth'" node-type="depth" :icon="EyeIcon">
    <div class="text-xs text-gray-400 space-y-1">
      <div class="flex justify-between">
        <span>Model</span>
        <span class="text-gray-500">{{ modelLabel }}</span>
      </div>
      <div class="flex justify-between">
        <span>Device</span>
        <span class="text-gray-500">{{ data.params.device }}</span>
      </div>
      <div v-if="state.status === 'error'" class="text-red-400 text-[10px] mt-1">
        {{ state.error }}
      </div>
    </div>
  </BaseNode>
</template>
