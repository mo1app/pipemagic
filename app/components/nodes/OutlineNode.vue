<script setup lang="ts">
import { PaintBrushIcon } from '@heroicons/vue/20/solid'
import BaseNode from '~/components/nodes/BaseNode.vue'
import { usePipelineStore } from '~/stores/pipeline'

const props = defineProps<{ id: string; label?: string; data: { params: Record<string, unknown> } }>()

const store = usePipelineStore()
const state = computed(() => store.getNodeState(props.id))
</script>

<template>
  <BaseNode :id="id" :label="label || 'Outline'" node-type="outline" :icon="PaintBrushIcon">
    <div class="text-xs text-gray-400 space-y-1">
      <div class="flex justify-between">
        <span>Thickness</span>
        <span class="text-gray-500">{{ data.params.thickness }}px</span>
      </div>
      <div class="flex items-center justify-between">
        <span>Color</span>
        <span
          class="w-4 h-4 rounded border border-gray-600"
          :style="{ backgroundColor: data.params.color as string }"
        />
      </div>
      <div class="flex justify-between">
        <span>Position</span>
        <span class="text-gray-500">{{ data.params.position }}</span>
      </div>
      <div v-if="state.status === 'error'" class="text-red-400 text-[10px] mt-1">
        {{ state.error }}
      </div>
    </div>
  </BaseNode>
</template>
