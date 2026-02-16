<script setup lang="ts">
import { ScissorsIcon } from '@heroicons/vue/20/solid'
import BaseNode from '~/components/nodes/BaseNode.vue'
import { usePipelineStore } from '~/stores/pipeline'

const props = defineProps<{ id: string; label?: string; data: { params: Record<string, unknown> } }>()

const store = usePipelineStore()
const state = computed(() => store.getNodeState(props.id))
</script>

<template>
  <BaseNode :id="id" :label="label || 'Remove BG'" node-type="remove-bg" :icon="ScissorsIcon">
    <div class="text-xs text-gray-400 space-y-1">
      <div class="flex justify-between">
        <span>Model</span>
        <span class="text-gray-500">RMBG-1.4</span>
      </div>
      <div v-if="state.status === 'error'" class="text-red-400 text-[10px] mt-1">
        {{ state.error }}
      </div>
    </div>
  </BaseNode>
</template>
