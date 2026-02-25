<script setup lang="ts">
import { usePipelineStore } from '~/stores/pipeline'

const store = usePipelineStore()

const leftPanel = ref<{ isDragging: Ref<boolean>; toggle: () => void } | null>(null)
const rightPanel = ref<{ isDragging: Ref<boolean> } | null>(null)

const anyPanelDragging = computed(() =>
  leftPanel.value?.isDragging.value
  || rightPanel.value?.isDragging.value
)

const onPipelineMessage = (e: MessageEvent) => {
  if (e.data?.type === 'load-pipeline' && e.data.pipeline) {
    store.loadPipeline(e.data.pipeline)
  }
}

onMounted(() => {
  window.addEventListener('message', onPipelineMessage)
  if (!store.restoreFromStorage()) {
    store.loadDefaultPipeline()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onPipelineMessage)
})
</script>

<template>
  <div class="h-screen flex flex-col" :class="{ 'select-none': anyPanelDragging }">
    <TopBar @toggle-about="leftPanel?.toggle()" />
    <div class="flex-1 flex min-h-0">
      <ResizablePanel
        ref="leftPanel"
        panel-key="left"
        side="left"
        :default-width="280"
        :min-width="180"
        :max-width="280"
        title="Panel"
      >
        <AboutPanel />
      </ResizablePanel>

      <div class="flex-1 relative" :class="{ 'pointer-events-none': anyPanelDragging }">
        <PipelineCanvas />
        <ProgressOverlay />
      </div>

      <ResizablePanel
        ref="rightPanel"
        panel-key="right"
        side="right"
        :default-width="280"
        :min-width="180"
        :max-width="280"
        title="Inspector"
      >
        <NodeInspector />
      </ResizablePanel>
    </div>
  </div>
</template>
