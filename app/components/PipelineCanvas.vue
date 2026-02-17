<script setup lang="ts">
import { VueFlow, useVueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";
import "@vue-flow/minimap/dist/style.css";
import { markRaw } from "vue";
import { nanoid } from "nanoid";
import { useElementSize } from "@vueuse/core";
import { usePipelineStore } from "~/stores/pipeline";
import type { NodeType } from "~~/shared/types/pipeline";

import InputNode from "~/components/nodes/InputNode.vue";
import OutputNode from "~/components/nodes/OutputNode.vue";
import RemoveBgNode from "~/components/nodes/RemoveBgNode.vue";
import UpscaleNode from "~/components/nodes/UpscaleNode.vue";
import NormalizeNode from "~/components/nodes/NormalizeNode.vue";
import OutlineNode from "~/components/nodes/OutlineNode.vue";
import DepthNode from "~/components/nodes/DepthNode.vue";
import FaceParseNode from "~/components/nodes/FaceParseNode.vue";

const nodeTypes = {
  input: markRaw(InputNode),
  output: markRaw(OutputNode),
  "remove-bg": markRaw(RemoveBgNode),
  normalize: markRaw(NormalizeNode),
  upscale: markRaw(UpscaleNode),
  outline: markRaw(OutlineNode),
  depth: markRaw(DepthNode),
  "face-parse": markRaw(FaceParseNode),
};

const store = usePipelineStore();

const containerRef = ref<HTMLElement | null>(null);
const { width: containerW, height: containerH } = useElementSize(containerRef);
const MINIMAP_BASE = 100;
const minimapW = computed(() => {
  if (!containerH.value) return MINIMAP_BASE;
  const aspect = containerW.value / containerH.value;
  return Math.round(aspect >= 1 ? MINIMAP_BASE * aspect : MINIMAP_BASE);
});
const minimapH = computed(() => {
  if (!containerH.value) return MINIMAP_BASE;
  const aspect = containerW.value / containerH.value;
  return Math.round(aspect >= 1 ? MINIMAP_BASE : MINIMAP_BASE / aspect);
});

const {
  onNodeClick,
  onPaneClick,
  onConnect,
  onEdgeClick,
  onEdgeContextMenu,
  onEdgeUpdateStart,
  onEdgeUpdate,
  onEdgeUpdateEnd,
  onMoveStart,
  project,
  setCenter,
  getViewport,
  fitView,
} = useVueFlow();

// Sync selection
onNodeClick(({ node }) => {
  store.selectNode(node.id);
});

onEdgeClick(({ edge }) => {
  store.selectEdge(edge.id);
});

onPaneClick(() => {
  store.selectNode(null);
  store.selectEdge(null);
});

// Handle new connections
onConnect((connection) => {
  store.edges.push({
    id: nanoid(8),
    source: connection.source,
    sourceHandle: connection.sourceHandle || "output",
    target: connection.target,
    targetHandle: connection.targetHandle || "input",
  } as any);
  store.isDirty = true;
});

// Edge context menu (right-click)
const edgeContextMenu = ref<{ x: number; y: number; edgeId: string; show: boolean }>({
  x: 0,
  y: 0,
  edgeId: "",
  show: false,
});

onEdgeContextMenu(({ event, edge }) => {
  event.preventDefault();
  edgeContextMenu.value = { x: event.clientX, y: event.clientY, edgeId: edge.id, show: true };
});

function deleteEdgeFromMenu() {
  store.removeEdge(edgeContextMenu.value.edgeId);
  edgeContextMenu.value.show = false;
}

// Close edge context menu when selection changes
watch(
  () => [store.selectedNodeId, store.selectedEdgeId],
  () => {
    edgeContextMenu.value.show = false;
  },
);

// Drag-to-disconnect / reconnect
let edgeUpdateSuccessful = false;

onEdgeUpdateStart(() => {
  edgeUpdateSuccessful = false;
});

onEdgeUpdate(({ edge, connection }) => {
  edgeUpdateSuccessful = true;
  // Replace edge with new connection
  store.removeEdge(edge.id);
  store.edges.push({
    id: nanoid(8),
    source: connection.source,
    sourceHandle: connection.sourceHandle || "output",
    target: connection.target,
    targetHandle: connection.targetHandle || "input",
  } as any);
  store.isDirty = true;
});

onEdgeUpdateEnd(({ edge }) => {
  if (!edgeUpdateSuccessful) {
    store.removeEdge(edge.id);
  }
});

// Context menu for adding nodes
const contextMenu = ref<{ x: number; y: number; show: boolean }>({
  x: 0,
  y: 0,
  show: false,
});

const addableNodes: { type: NodeType; label: string }[] = [
  { type: "remove-bg", label: "Remove BG" },
  { type: "normalize", label: "Normalize" },
  { type: "outline", label: "Outline" },
  { type: "upscale", label: "Upscale 2x" },
  { type: "depth", label: "Estimate Depth" },
  { type: "face-parse", label: "Face Parse" },
];

function onPaneContextMenu(event: MouseEvent) {
  event.preventDefault();
  contextMenu.value = { x: event.clientX, y: event.clientY, show: true };
}

function addNodeFromMenu(type: NodeType) {
  const canvasPos = project({ x: contextMenu.value.x, y: contextMenu.value.y });
  store.addNode(type, canvasPos);
  contextMenu.value.show = false;
}

function closeContextMenu() {
  contextMenu.value.show = false;
  edgeContextMenu.value.show = false;
}

onMoveStart(closeContextMenu);

// Pan camera to newly added nodes (single add only)
let prevNodeCount = 0;
let lastLoadCount = store.pipelineLoadCount;
watch(
  () => store.nodes.length,
  (len) => {
    // Skip when a bulk pipeline load just changed the node count
    if (store.pipelineLoadCount !== lastLoadCount) {
      lastLoadCount = store.pipelineLoadCount;
      prevNodeCount = len;
      return;
    }
    if (len === prevNodeCount + 1 && prevNodeCount > 0) {
      const node = store.nodes[len - 1];
      if (node) {
        nextTick(() => {
          const { zoom } = getViewport();
          setCenter(node.position.x + 90, node.position.y + 100, {
            duration: 300,
            zoom,
          });
        });
      }
    }
    prevNodeCount = len;
  },
  { immediate: true },
);

// Fit all nodes when a pipeline is loaded (preset, file open, default)
watch(
  () => store.pipelineLoadCount,
  () => {
    nextTick(() => {
      fitView({ duration: 300, padding: 0.2 });
    });
  },
);
</script>

<template>
  <div ref="containerRef" class="w-full h-full" @click="closeContextMenu">
    <VueFlow
      v-model:nodes="store.nodes"
      v-model:edges="store.edges"
      :node-types="nodeTypes"
      :default-viewport="{ x: 0, y: 0, zoom: 0.85 }"
      :snap-to-grid="true"
      :snap-grid="[20, 20]"
      :min-zoom="0.2"
      :max-zoom="2"
      :edges-updatable="true"
      :delete-key-code="null"
      fit-view-on-init
      @pane-contextmenu="onPaneContextMenu"
    >
      <Background :gap="20" :size="3" pattern-color="#222" />
      <Controls />
      <MiniMap
        mask-color="rgba(0, 0, 0, 0.2)"
        node-color="#555"
        node-stroke-color="transparent"
        :width="minimapW"
        :height="minimapH"
      />
    </VueFlow>

    <!-- Add-node context menu -->
    <Teleport to="body">
      <div
        v-if="contextMenu.show"
        class="fixed z-50 bg-gray-1200 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      >
        <div
          class="px-3 py-1.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider"
        >
          Add Node
        </div>
        <button
          v-for="node in addableNodes"
          :key="node.type"
          class="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          @click.stop="addNodeFromMenu(node.type)"
        >
          {{ node.label }}
        </button>
      </div>
    </Teleport>

    <!-- Edge context menu -->
    <Teleport to="body">
      <div
        v-if="edgeContextMenu.show"
        class="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]"
        :style="{ left: `${edgeContextMenu.x}px`, top: `${edgeContextMenu.y}px` }"
        @click.stop
      >
        <button
          class="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors"
          @click.stop="deleteEdgeFromMenu"
        >
          Delete Edge
        </button>
      </div>
    </Teleport>
  </div>
</template>
