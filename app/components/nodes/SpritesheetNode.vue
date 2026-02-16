<script setup lang="ts">
import { Squares2X2Icon } from '@heroicons/vue/20/solid'
import BaseNode from '~/components/nodes/BaseNode.vue'
import { usePipelineStore } from '~/stores/pipeline'

const props = defineProps<{ id: string; label?: string; data: { params: Record<string, unknown> } }>()

const store = usePipelineStore()
const state = computed(() => store.getNodeState(props.id))

const columnsLabel = computed(() => {
  const v = props.data.params.columns
  return v === 'auto' ? 'Auto' : `${v}`
})

const rowsLabel = computed(() => {
  const v = props.data.params.rows
  return v === 'auto' ? 'Auto' : `${v}`
})
</script>

<template>
  <BaseNode :id="id" :label="label || 'Spritesheet'" node-type="spritesheet" :icon="Squares2X2Icon">
    <div class="text-xs text-gray-400 space-y-1">
      <div class="flex justify-between">
        <span>Columns</span>
        <span class="text-gray-500">{{ columnsLabel }}</span>
      </div>
      <div class="flex justify-between">
        <span>Rows</span>
        <span class="text-gray-500">{{ rowsLabel }}</span>
      </div>
      <div class="flex justify-between">
        <span>Gap</span>
        <span class="text-gray-500">{{ data.params.gap }}px</span>
      </div>
      <div v-if="state.status === 'error'" class="text-red-400 text-[10px] mt-1">
        {{ state.error }}
      </div>
    </div>
  </BaseNode>
</template>
