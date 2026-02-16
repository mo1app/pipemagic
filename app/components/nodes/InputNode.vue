<script setup lang="ts">
import { PhotoIcon } from "@heroicons/vue/20/solid";
import BaseNode from "~/components/nodes/BaseNode.vue";
import { usePipelineStore } from "~/stores/pipeline";
import { fileToBitmap, resizeBitmap } from "pipemagic";
import type { ImageFrame } from "~~/shared/types/image-frame";

const props = defineProps<{
  id: string;
  label?: string;
  data: { params: Record<string, unknown> };
}>();

const store = usePipelineStore();
const isDragging = ref(false);

const frame = computed(() => store.inputImages.get(props.id) || null);

async function handleFile(file: File) {
  if (!file.type.startsWith("image/")) return;
  const bitmap = await fileToBitmap(file);
  const maxSize = (props.data.params.maxSize as number) || 2048;
  const fit =
    (props.data.params.fit as "contain" | "cover" | "fill") || "contain";
  const resized = await resizeBitmap(bitmap, maxSize, fit);
  const imageFrame: ImageFrame = {
    bitmap: resized,
    width: resized.width,
    height: resized.height,
    revision: Date.now(),
  };
  store.setInputImage(props.id, imageFrame);
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
  const file = e.dataTransfer?.files[0];
  if (file) handleFile(file);
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  isDragging.value = true;
}

function onDragLeave() {
  isDragging.value = false;
}

function openFilePicker() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) handleFile(file);
  };
  input.click();
}
</script>

<template>
  <BaseNode
    :id="id"
    :label="label || 'Input'"
    node-type="input"
    :icon="PhotoIcon"
  >
    <div
      :class="[
        'border-2 border-dashed rounded-md p-3 text-center cursor-pointer transition-all min-h-[80px] flex flex-col items-center justify-center gap-1',
        isDragging || !frame
          ? 'border-[#535DFF] bg-[#535DFF]/10 shadow-[0_0_12px_rgba(83,93,255,0.4)]'
          : 'border-gray-600 hover:border-gray-500',
      ]"
      @drop="onDrop"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @click="openFilePicker"
    >
      <span v-if="!frame" class="relative text-xs text-gray-500">
        Drop image or click
        <span class="shiny-overlay" aria-hidden="true"
          >Drop image or click</span
        >
      </span>
      <span v-else class="text-xs text-gray-500">Drop image or click</span>
    </div>
  </BaseNode>
</template>

<style scoped>
.shiny-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    120deg,
    rgba(148, 154, 233, 0) 0%,
    rgba(83, 93, 255, 1) 30%,
    rgba(255, 255, 255, 1) 50%,
    rgba(83, 93, 255, 1) 70%,
    rgba(148, 154, 233, 0) 100%
  );
  background-size: 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shine 3s ease-in-out infinite;
}

@keyframes shine {
  0% {
    opacity: 0;
    background-position: 150% 50%;
  }
  15% {
    opacity: 1;
  }
  85% {
    opacity: 0;
  }
  100% {
    opacity: 0;
    background-position: -50% 50%;
  }
}
</style>
