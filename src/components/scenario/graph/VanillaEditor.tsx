/**
 * Vanilla React Flow "Add Node on Edge Drop" example, drop-in
 * replacement for GraphEditor — used to bisect where the gesture
 * regression lives. If THIS works on the scenario edit page but
 * GraphEditor doesn't, the issue is inside GraphEditor (custom
 * shapes, palette, picker). If THIS also doesn't work, the issue
 * is in our page-level wrappers (AppLayout, providers, etc).
 *
 * Intentionally has no AntD, no custom CSS, no custom shapes. Same
 * code as src/pages/RFExample.tsx but mounted as a component
 * instead of a full-screen route.
 */

import { useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type OnConnect,
  type OnConnectStart,
  type OnConnectEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const initialNodes: Node[] = [
  {
    id: "0",
    type: "input",
    data: { label: "Node" },
    position: { x: 0, y: 50 },
  },
];

let nextId = 1;
const getId = () => `${nextId++}`;
const nodeOrigin: [number, number] = [0.5, 0];

function AddNodeOnEdgeDrop() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const connectingNodeId = useRef<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition } = useReactFlow();

  const onConnect: OnConnect = useCallback(
    (params) => {
      connectingNodeId.current = null;
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges],
  );

  const onConnectStart: OnConnectStart = useCallback((_event, { nodeId }) => {
    connectingNodeId.current = nodeId;
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (!connectionState.isValid) {
        const id = getId();
        const { clientX, clientY } =
          "changedTouches" in event ? event.changedTouches[0] : event;
        const newNode: Node = {
          id,
          position: screenToFlowPosition({ x: clientX, y: clientY }),
          data: { label: `Node ${id}` },
          origin: [0.5, 0],
        };
        setNodes((nds) => nds.concat(newNode));
        setEdges((eds) =>
          eds.concat({
            id,
            source: connectingNodeId.current ?? "",
            target: id,
          }),
        );
      }
    },
    [screenToFlowPosition, setNodes, setEdges],
  );

  return (
    <div ref={reactFlowWrapper} style={{ width: "100%", height: 640 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        fitView
        fitViewOptions={{ padding: 2 }}
        nodeOrigin={nodeOrigin}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export function VanillaEditor() {
  return (
    <ReactFlowProvider>
      <AddNodeOnEdgeDrop />
    </ReactFlowProvider>
  );
}
