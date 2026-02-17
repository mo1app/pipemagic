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
import {
  PhotoIcon,
  ArrowDownTrayIcon,
  ScissorsIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  PaintBrushIcon,
  EyeIcon,
  UserIcon,
  Squares2X2Icon,
  TrashIcon,
} from "@heroicons/vue/20/solid";
import { usePipelineStore } from "~/stores/pipeline";
import { getHandleDefs } from "pipemagic";
import type { NodeType } from "~~/shared/types/pipeline";
import type { Connection } from "@vue-flow/core";

import InputNode from "~/components/nodes/InputNode.vue";
import OutputNode from "~/components/nodes/OutputNode.vue";
import RemoveBgNode from "~/components/nodes/RemoveBgNode.vue";
import UpscaleNode from "~/components/nodes/UpscaleNode.vue";
import NormalizeNode from "~/components/nodes/NormalizeNode.vue";
import OutlineNode from "~/components/nodes/OutlineNode.vue";
import DepthNode from "~/components/nodes/DepthNode.vue";
import FaceParseNode from "~/components/nodes/FaceParseNode.vue";
import SpritesheetNode from "~/components/nodes/SpritesheetNode.vue";

const nodeTypes = {
  input: markRaw(InputNode),
  output: markRaw(OutputNode),
  "remove-bg": markRaw(RemoveBgNode),
  normalize: markRaw(NormalizeNode),
  upscale: markRaw(UpscaleNode),
  outline: markRaw(OutlineNode),
  depth: markRaw(DepthNode),
  "face-parse": markRaw(FaceParseNode),
  spritesheet: markRaw(SpritesheetNode),
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
  onNodeContextMenu,
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
  if (!connection.source || !connection.target) return;
  // Validate connection before adding
  if (!isValidConnection(connection)) return;

  store.edges.push({
    id: nanoid(8),
    source: connection.source,
    sourceHandle: connection.sourceHandle || "asset",
    target: connection.target,
    targetHandle: connection.targetHandle || "asset",
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

// Node context menu (right-click)
const nodeContextMenu = ref<{ x: number; y: number; nodeId: string; show: boolean }>({
  x: 0,
  y: 0,
  nodeId: "",
  show: false,
});

onNodeContextMenu(({ event, node }) => {
  event.preventDefault();
  nodeContextMenu.value = { x: event.clientX, y: event.clientY, nodeId: node.id, show: true };
});

function deleteNodeFromMenu() {
  store.removeNode(nodeContextMenu.value.nodeId);
  nodeContextMenu.value.show = false;
}

// Close context menus when selection changes
watch(
  () => [store.selectedNodeId, store.selectedEdgeId],
  () => {
    edgeContextMenu.value.show = false;
    nodeContextMenu.value.show = false;
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
    sourceHandle: connection.sourceHandle || "asset",
    target: connection.target,
    targetHandle: connection.targetHandle || "asset",
  } as any);
  store.isDirty = true;
});

onEdgeUpdateEnd(({ edge }) => {
  if (!edgeUpdateSuccessful) {
    store.removeEdge(edge.id);
  }
});

// Connection validation: check data type compatibility
function isValidConnection(connection: Connection) {
  const sourceNode = store.nodes.find((n: any) => n.id === connection.source);
  const targetNode = store.nodes.find((n: any) => n.id === connection.target);
  if (!sourceNode || !targetNode) return false;

  const sourceDefs = getHandleDefs(sourceNode.type as NodeType);
  const targetDefs = getHandleDefs(targetNode.type as NodeType);

  const sourceHandle = sourceDefs.sources.find(
    (h) => h.id === (connection.sourceHandle || "asset"),
  );
  const targetHandle = targetDefs.targets.find(
    (h) => h.id === (connection.targetHandle || "asset"),
  );

  if (!sourceHandle || !targetHandle) return false;
  if (sourceHandle.dataType !== targetHandle.dataType) return false;

  // Block multiple connections to the same non-multi target handle
  if (!targetHandle.multi) {
    const targetHandleId = connection.targetHandle || "asset";
    const alreadyConnected = store.edges.some(
      (e: any) => e.target === connection.target && e.targetHandle === targetHandleId,
    );
    if (alreadyConnected) return false;
  }

  return true;
}
// Context menu for adding nodes
const contextMenu = ref<{ x: number; y: number; show: boolean }>({
  x: 0,
  y: 0,
  show: false,
});

const addableNodes: { type: NodeType; label: string; icon: Component; separator?: boolean }[] = [
  { type: "input", label: "Image Input", icon: PhotoIcon },
  { type: "output", label: "Output", icon: ArrowDownTrayIcon },
  { type: "remove-bg", label: "Remove BG", icon: ScissorsIcon, separator: true },
  { type: "normalize", label: "Normalize", icon: ArrowsPointingInIcon },
  { type: "outline", label: "Outline", icon: PaintBrushIcon },
  { type: "upscale", label: "Upscale 2x", icon: ArrowsPointingOutIcon },
  { type: "depth", label: "Estimate Depth", icon: EyeIcon },
  { type: "face-parse", label: "Face Parse", icon: UserIcon },
  { type: "spritesheet", label: "Spritesheet", icon: Squares2X2Icon },
];

function onPaneContextMenu(event: MouseEvent) {
  event.preventDefault();
  contextMenu.value = { x: event.clientX, y: event.clientY, show: true };
}

function onCanvasContextMenu(event: MouseEvent) {
  // Only show add-node menu if not clicking on a node or edge (those have their own menus)
  const target = event.target as HTMLElement;
  if (target.closest('.vue-flow__node') || target.closest('.vue-flow__edge')) return;
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
  nodeContextMenu.value.show = false;
}

// Position context menus so they don't overflow the viewport
function menuStyle(x: number, y: number) {
  const style: Record<string, string> = { position: 'fixed', left: `${x}px`, top: `${y}px` }
  // Flip upward if near bottom (estimate ~300px max menu height)
  if (y + 300 > window.innerHeight) {
    style.top = ''
    style.bottom = `${window.innerHeight - y}px`
  }
  // Flip left if near right edge
  if (x + 200 > window.innerWidth) {
    style.left = ''
    style.right = `${window.innerWidth - x}px`
  }
  return style
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
  <div ref="containerRef" class="w-full h-full" @click="closeContextMenu" @contextmenu.prevent="onCanvasContextMenu">
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
        class="z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[180px]"
        :style="menuStyle(contextMenu.x, contextMenu.y)"
        @click.stop
      >
        <template v-for="(node, i) in addableNodes" :key="node.type">
          <div v-if="node.separator" class="h-px bg-gray-700 my-1" />
          <button
            class="w-full text-left mx-1 px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-800/80 hover:text-white rounded-md transition-colors flex items-center gap-2"
            style="width: calc(100% - 0.5rem)"
            @click.stop="addNodeFromMenu(node.type)"
          >
            <component :is="node.icon" class="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span class="flex-1">{{ node.label }}</span>
          </button>
        </template>
      </div>
    </Teleport>

    <!-- Edge context menu -->
    <Teleport to="body">
      <div
        v-if="edgeContextMenu.show"
        class="z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[180px]"
        :style="menuStyle(edgeContextMenu.x, edgeContextMenu.y)"
        @click.stop
      >
        <button
          class="w-full text-left mx-1 px-2 py-1.5 text-xs text-red-400 hover:bg-gray-800/80 hover:text-red-300 rounded-md transition-colors flex items-center gap-2"
          style="width: calc(100% - 0.5rem)"
          @click.stop="deleteEdgeFromMenu"
        >
          <TrashIcon class="w-3.5 h-3.5 flex-shrink-0" />
          <span class="flex-1">Delete Edge</span>
        </button>
      </div>
    </Teleport>

    <!-- Node context menu -->
    <Teleport to="body">
      <div
        v-if="nodeContextMenu.show"
        class="z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[180px]"
        :style="menuStyle(nodeContextMenu.x, nodeContextMenu.y)"
        @click.stop
      >
        <button
          class="w-full text-left mx-1 px-2 py-1.5 text-xs text-red-400 hover:bg-gray-800/80 hover:text-red-300 rounded-md transition-colors flex items-center gap-2"
          style="width: calc(100% - 0.5rem)"
          @click.stop="deleteNodeFromMenu"
        >
          <TrashIcon class="w-3.5 h-3.5 flex-shrink-0" />
          <span class="flex-1">Delete Node</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>
