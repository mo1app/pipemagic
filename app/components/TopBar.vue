<script setup lang="ts">
import { nanoid } from "nanoid";
import {
  DocumentPlusIcon,
  FolderOpenIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  PhotoIcon,
  ScissorsIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  PaintBrushIcon,
  SparklesIcon,
  EyeIcon,
  UserIcon,
  Squares2X2Icon,
} from "@heroicons/vue/20/solid";
import type { NodeType } from "~~/shared/types/pipeline";
import { usePipelineStore } from "~/stores/pipeline";
import { useFileIo } from "~/composables/useFileIo";
import { usePipelineRunner } from "~/composables/usePipelineRunner";
import { DEFAULT_PARAMS } from "~~/shared/types/node-params";
import type { PipelineDefinition } from "~~/shared/types/pipeline";
import type { MenuItem } from "~/components/DropdownMenu.vue";

const emit = defineEmits<{ "toggle-about": [] }>();

const store = usePipelineStore();
const { savePipeline, savePipelineAs, openPipeline, newPipeline } = useFileIo();
const { run: runPipeline, stop, runError } = usePipelineRunner();

const highlightRun = computed(() => {
  if (store.isRunning || store.inputImages.size === 0) return false;
  return store.nodes.some((n) => {
    const state = store.nodeStates.get(n.id);
    return !state || (state.status !== "done" && state.status !== "cached");
  });
});

// Auto-run pipeline when an image is uploaded
watch(
  () => store.inputImages,
  () => {
    if (store.inputImages.size > 0) {
      if (store.isRunning) {
        stop();
        setTimeout(() => run(), 50);
      } else {
        run();
      }
    }
  },
);

async function run() {
  try {
    store.hasRun = true;
    await runPipeline();
  } catch (e: any) {
    console.error("Pipeline run error:", e);
  }
}

const gpuSupported = ref(false);
onMounted(async () => {
  gpuSupported.value =
    !!navigator.gpu && !!(await navigator.gpu.requestAdapter());
});

// Presets
function buildStickerPreset(): PipelineDefinition {
  const inputId = nanoid(8);
  const removeBgId = nanoid(8);
  const normalizeId = nanoid(8);
  const outlineId = nanoid(8);
  const upscaleId = nanoid(8);
  const outputId = nanoid(8);
  return {
    version: 1,
    nodes: [
      {
        id: inputId,
        type: "input",
        position: { x: 60, y: 180 },
        params: { maxSize: 2048, fit: "contain" },
        label: "Image Input",
      },
      {
        id: removeBgId,
        type: "remove-bg",
        position: { x: 380, y: 180 },
        params: { device: "auto", dtype: "fp16" },
        label: "Remove BG",
      },
      {
        id: normalizeId,
        type: "normalize",
        position: { x: 680, y: 180 },
        params: { size: 2048, padding: 160 },
        label: "Normalize",
      },
      {
        id: outlineId,
        type: "outline",
        position: { x: 940, y: 200 },
        params: {
          thickness: 50,
          color: "#ffffff",
          opacity: 1,
          quality: "high",
          position: "outside",
          threshold: 5,
        },
        label: "Outline",
      },
      {
        id: upscaleId,
        type: "upscale",
        position: { x: 1220, y: 200 },
        params: { model: "cnn-2x-l", contentType: "rl" },
        label: "Upscale 2x",
      },
      {
        id: outputId,
        type: "output",
        position: { x: 1500, y: 180 },
        params: { ...DEFAULT_PARAMS["output"] },
        label: "Output",
      },
    ],
    edges: [
      {
        id: nanoid(8),
        source: inputId,
        sourceHandle: "asset",
        target: removeBgId,
        targetHandle: "asset",
      },
      {
        id: nanoid(8),
        source: removeBgId,
        sourceHandle: "asset",
        target: normalizeId,
        targetHandle: "asset",
      },
      {
        id: nanoid(8),
        source: normalizeId,
        sourceHandle: "asset",
        target: outlineId,
        targetHandle: "asset",
      },
      {
        id: nanoid(8),
        source: outlineId,
        sourceHandle: "asset",
        target: upscaleId,
        targetHandle: "asset",
      },
      {
        id: nanoid(8),
        source: upscaleId,
        sourceHandle: "asset",
        target: outputId,
        targetHandle: "asset",
      },
    ],
  };
}

function loadPreset(build: () => PipelineDefinition) {
  store.loadPipeline(build());
  store.fileHandle = null;
  store.fileName = null;
}

const fileMenuItems = computed<MenuItem[]>(() => [
  {
    label: "New",
    icon: DocumentPlusIcon,
    shortcut: ["⌘", "N"],
    action: newPipeline,
  },
  {
    label: "Open...",
    icon: FolderOpenIcon,
    shortcut: ["⌘", "O"],
    action: openPipeline,
  },
  { separator: true, label: "" },
  {
    label: "Save",
    icon: ArrowDownTrayIcon,
    shortcut: ["⌘", "S"],
    action: savePipeline,
  },
  {
    label: "Save As...",
    icon: DocumentDuplicateIcon,
    shortcut: ["⇧", "⌘", "S"],
    action: savePipelineAs,
  },
]);

function buildDepthMapPreset(): PipelineDefinition {
  const inputId = nanoid(8);
  const depthId = nanoid(8);
  const outputId = nanoid(8);
  return {
    version: 1,
    nodes: [
      {
        id: inputId,
        type: "input",
        position: { x: -20, y: 180 },
        params: { maxSize: 2048, fit: "contain" },
        label: "Image Input",
      },
      {
        id: depthId,
        type: "depth",
        position: { x: 340, y: 240 },
        params: { model: "fast", device: "auto" },
        label: "Estimate Depth",
      },
      {
        id: outputId,
        type: "output",
        position: { x: 680, y: 160 },
        params: { ...DEFAULT_PARAMS["output"] },
        label: "Output",
      },
    ],
    edges: [
      {
        id: nanoid(8),
        source: inputId,
        sourceHandle: "asset",
        target: depthId,
        targetHandle: "asset",
      },
      {
        id: nanoid(8),
        source: depthId,
        sourceHandle: "asset",
        target: outputId,
        targetHandle: "asset",
      },
    ],
  };
}

const presetMenuItems = computed<MenuItem[]>(() => [
  {
    label: "Sticker",
    icon: SparklesIcon,
    action: () => loadPreset(buildStickerPreset),
  },
  {
    label: "Depth Map",
    icon: EyeIcon,
    action: () => loadPreset(buildDepthMapPreset),
  },
]);

function addNodeAtCenter(type: NodeType) {
  // Place below and to the right of the rightmost node to avoid overlaps
  let maxX = 0;
  let maxY = 0;
  for (const n of store.nodes) {
    if (n.position.x > maxX) maxX = n.position.x;
    if (n.position.y > maxY) maxY = n.position.y;
  }
  store.addNode(type, { x: maxX + 300, y: maxY });
}

const addNodeItems = computed<MenuItem[]>(() => [
  {
    label: "Image Input",
    icon: PhotoIcon,
    action: () => addNodeAtCenter("input"),
  },
  {
    label: "Output",
    icon: ArrowDownTrayIcon,
    action: () => addNodeAtCenter("output"),
  },
  { separator: true, label: "" },
  {
    label: "Remove BG",
    icon: ScissorsIcon,
    action: () => addNodeAtCenter("remove-bg"),
  },
  {
    label: "Normalize",
    icon: ArrowsPointingInIcon,
    action: () => addNodeAtCenter("normalize"),
  },
  {
    label: "Outline",
    icon: PaintBrushIcon,
    action: () => addNodeAtCenter("outline"),
  },
  {
    label: "Upscale 2x",
    icon: ArrowsPointingOutIcon,
    action: () => addNodeAtCenter("upscale"),
  },
  {
    label: "Estimate Depth",
    icon: EyeIcon,
    action: () => addNodeAtCenter("depth"),
  },
  {
    label: "Face Parse",
    icon: UserIcon,
    action: () => addNodeAtCenter("face-parse"),
  },
  {
    label: "Spritesheet",
    icon: Squares2X2Icon,
    action: () => addNodeAtCenter("spritesheet"),
  },
]);

function handleKeyboard(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === "s") {
    e.preventDefault();
    if (e.shiftKey) savePipelineAs();
    else savePipeline();
  }
  if (mod && e.key === "o") {
    e.preventDefault();
    openPipeline();
  }
  if (mod && e.key === "Enter") {
    e.preventDefault();
    if (store.isRunning) stop();
    else run();
  }
  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as Element)?.tagName)
  ) {
    // Delete or Backspace removes selected node
    if (store.selectedNodeId) {
      e.preventDefault();
      store.removeNode(store.selectedNodeId);
    }
    // Also remove selected edge
    if (store.selectedEdgeId) {
      e.preventDefault();
      store.removeEdge(store.selectedEdgeId);
    }
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeyboard);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyboard);
});
</script>

<template>
  <div
    class="h-11 bg-gray-900 border-b border-gray-800 flex items-center px-3 gap-2 flex-shrink-0"
  >
    <img src="/logo.svg" alt="PipeMagic" class="w-6 h-6" />
    <!-- Logo / Title -->
    <span class="text-sm font-semibold text-gray-300 mr-4"> PipeMagic </span>

    <!-- File menu -->
    <DropdownMenu label="File" :items="fileMenuItems" />
    <DropdownMenu label="Add Node" :items="addNodeItems" />
    <DropdownMenu label="Presets" :items="presetMenuItems" />
    <!-- About toggle -->
    <button
      class="px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
      @click="emit('toggle-about')"
    >
      About
    </button>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Status indicators -->
    <span
      v-if="store.fileName"
      class="text-[10px] text-gray-500 max-w-[200px] truncate"
    >
      {{ store.fileName }}
    </span>
    <!-- Run error -->
    <span
      v-if="runError"
      class="text-[10px] text-red-400 max-w-[300px] truncate px-2"
      :title="runError"
    >
      {{ runError }}
    </span>
    <!-- Run/Stop -->
    <button
      v-if="!store.isRunning"
      :class="[
        'flex items-center px-3 py-1 text-xs font-medium rounded text-white transition-colors',
        highlightRun
          ? 'bg-[#535DFF] hover:bg-[#4750e0] shadow-[0_0_14px_rgba(83,93,255,0.5)] run-glow'
          : 'bg-gray-600 hover:bg-gray-500',
      ]"
      @click="run"
    >
      Run Pipeline
      <CommandShortcut :keys="['⌘', '↵']" />
    </button>
    <button
      v-else
      class="px-3 py-1 text-xs font-medium rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
      @click="stop"
    >
      Stop
    </button>
  </div>

  <!-- WebGPU/WASM tag -->
  <Teleport to="body">
    <span
      class="fixed bottom-2 right-2 z-50 text-[10px] px-1.5 py-0.5 rounded"
      :class="
        gpuSupported
          ? 'bg-green-900/30 text-green-400'
          : 'bg-yellow-900/30 text-yellow-400'
      "
    >
      {{ gpuSupported ? "WebGPU" : "WASM" }}
    </span>
  </Teleport>
</template>

<style scoped>
.run-glow {
  animation: glow-pulse 2s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%,
  100% {
    box-shadow: 0 0 8px rgba(83, 93, 255, 0.4);
  }
  50% {
    box-shadow: 0 0 20px rgba(83, 93, 255, 0.7);
  }
}
</style>
