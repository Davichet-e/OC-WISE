// src/GraphNormCreator.tsx
import React, { useState, useCallback, useEffect, ChangeEvent, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
  Node,
  Edge,
  ReactFlowInstance,
  NodeChange,
  EdgeChange,
  Handle,
  Position,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';
import AutocompleteInput from './AutocompleteInput';

// --- MOCK DATA FOR AUTOCOMPLETE ---
const activityNames: string[] = [
  "Create Purchase Order", "Approve Purchase Order", "Send Purchase Order",
  "Receive Goods", "Verify Invoice", "Pay Invoice", "Archive Document",
  "Update CRM", "Schedule Meeting", "Send Reminder", "Generate Report",
  "Place in Stock", "Bring to Loading Bay", "Book Vehicles", "Load Cargo",
];
const entityNames: string[] = [
  "Purchase Order", "Invoice", "Supplier", "Customer", "Product",
  "Shipment", "Payment", "Contract", "Employee", "Department",
  "Container", "Vehicle", "Order Line", "Delivery Note",
];

// --- TYPE DEFINITIONS ---
const NORM_TYPES = {
  AVERAGE_TIME_BETWEEN_ACTIVITIES: 'AverageTimeBetweenActivitiesNorm',
  OBJECT_FOLLOWS_OBJECT: 'ObjectFollowsObjectNorm',
  ACTIVITY_FREQUENCY: 'ActivityFrequencyNorm',
} as const;

type NormTypeKeys = keyof typeof NORM_TYPES;
type NormTypeValue = typeof NORM_TYPES[NormTypeKeys];

interface CustomNodeData {
  label: string;
  type: 'Activity' | 'Entity' | string;
  name: string;
  icon?: string;
  isSource?: boolean;
  isTarget?: boolean;
}

type AppNode = Node<CustomNodeData>;
type AppEdge = Edge<{ label?: string }>; // Allow label in edge data

interface GlobalNormDetails {
  norm_id: string;
  description: string;
  weight: number;
  threshold_seconds: string;
  max_allowed_count: string;
  aggregation_properties: string;
  // Edge label related fields
  avg_time_edge_label: string; // Corresponds to df_type_prop_name for display
  object_follows_edge_label: string;
  activity_frequency_edge_label: string;
  // Original fields, avg_time_edge_label might duplicate df_type_prop_name if it's purely for display
  df_type_prop_name: string; // This one is used in the actual norm object
  df_type_prop_value: string;
  entity_a_id_prop: string;
  context_entity_id_prop: string;
}

interface CreatedNorm {
  norm_type: NormTypeValue;
  norm_id: string;
  description: string;
  weight: number;
  activity_a?: string;
  activity_b?: string;
  threshold_seconds?: number;
  aggregation_properties?: string[];
  df_type_prop_name?: string; // This is part of the norm data
  df_type_prop_value?: string;
  entity_type_a?: string;
  entity_type_b?: string;
  entity_a_id_prop?: string;
  target_activity?: string;
  context_entity_type?: string;
  context_entity_id_prop?: string;
  max_allowed_count?: number;
  // Note: Visual edge labels from GlobalNormDetails are not part of CreatedNorm by default
  // unless explicitly added to the backend expectation.
}

type SelectedElementInfoNode = AppNode & { elementType: 'node' };
type SelectedElementInfoEdge = AppEdge & { elementType: 'edge' };
type SelectedElementInfo = SelectedElementInfoNode | SelectedElementInfoEdge | null;


const initialGlobalNormDetails: GlobalNormDetails = {
  norm_id: '',
  description: '',
  weight: 1.0,
  threshold_seconds: '',
  max_allowed_count: '',
  aggregation_properties: '',
  avg_time_edge_label: 'DF', // Default visual label for AvgTime
  object_follows_edge_label: 'DF_ENTITY', // Default visual label
  activity_frequency_edge_label: 'corr', // Default visual label
  df_type_prop_name: '', // Actual data field for AvgTime norm
  df_type_prop_value: '',
  entity_a_id_prop: 'ID',
  context_entity_id_prop: 'ID',
};

const SOURCE_NODE_ID = 'source-node';
const TARGET_NODE_ID = 'target-node';
const PREDEFINED_EDGE_ID = 'edge-1';

interface CustomNodeComponentProps {
  data: CustomNodeData;
  selected: boolean;
}

const CustomNode: React.FC<CustomNodeComponentProps> = ({ data, selected }) => {
  const nodeClasses = `custom-node ${data.type.toLowerCase()}-node ${selected ? 'selected' : ''}`;
  const displayName = data.name || `Unnamed ${data.type}`;

  return (
    <div className={nodeClasses}>
      <Handle type="target" position={Position.Left} className="custom-handle" isConnectable={false} />
      <div className="custom-node-header">
        <span className="node-icon">{data.icon || (data.type === 'Activity' ? '⚙️' : '🧱')}</span>
        <span className="node-type-label">{data.type}</span>
      </div>
      <div className="custom-node-body">
        <p className="node-name">{displayName}</p>
      </div>
      <Handle type="source" position={Position.Right} className="custom-handle" isConnectable={false} />
    </div>
  );
};

const getInitialEdgeLabel = (normType: NormTypeValue, details: GlobalNormDetails): string => {
  switch (normType) {
    case NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES:
      return details.avg_time_edge_label || details.df_type_prop_name || 'DF'; // Use specific label, fallback to prop_name or default
    case NORM_TYPES.OBJECT_FOLLOWS_OBJECT:
      return details.object_follows_edge_label || 'DF_ENTITY';
    case NORM_TYPES.ACTIVITY_FREQUENCY:
      return details.activity_frequency_edge_label || 'corr';
    default:
      return '';
  }
};

const getPredefinedNodesAndEdges = (normType: NormTypeValue, details: GlobalNormDetails): { nodes: AppNode[], edges: AppEdge[] } => {
  let predefinedNodes: AppNode[] = [];
  let predefinedEdges: AppEdge[] = [];
  const edgeLabel = getInitialEdgeLabel(normType, details);

  const sourceBaseData = { name: '', icon: '', label: '' };
  const targetBaseData = { name: '', icon: '', label: '' };

  switch (normType) {
    case NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES:
      predefinedNodes = [
        { id: SOURCE_NODE_ID, type: 'customNode', data: { ...sourceBaseData, type: 'Activity', icon: '⚙️', label: 'Activity A', isSource: true }, position: { x: 50, y: 150 }, draggable: true },
        { id: TARGET_NODE_ID, type: 'customNode', data: { ...targetBaseData, type: 'Activity', icon: '⚙️', label: 'Activity B', isTarget: true }, position: { x: 350, y: 150 }, draggable: true },
      ];
      break;
    case NORM_TYPES.OBJECT_FOLLOWS_OBJECT:
      predefinedNodes = [
        { id: SOURCE_NODE_ID, type: 'customNode', data: { ...sourceBaseData, type: 'Entity', icon: '🧱', label: 'Entity A', isSource: true }, position: { x: 50, y: 150 }, draggable: true },
        { id: TARGET_NODE_ID, type: 'customNode', data: { ...targetBaseData, type: 'Entity', icon: '🧱', label: 'Entity B', isTarget: true }, position: { x: 350, y: 150 }, draggable: true },
      ];
      break;
    case NORM_TYPES.ACTIVITY_FREQUENCY:
      predefinedNodes = [
        { id: SOURCE_NODE_ID, type: 'customNode', data: { ...targetBaseData, type: 'Activity', icon: '⚙️', label: 'Target Activity', isSource: true }, position: { x: 50, y: 150 }, draggable: true },
        { id: TARGET_NODE_ID, type: 'customNode', data: { ...sourceBaseData, type: 'Entity', icon: '🧱', label: 'Context Entity', isTarget: true }, position: { x: 350, y: 150 }, draggable: true },
      ];
      break;
    default: // Should not happen with TypeScript
      predefinedNodes = [];
  }
  if (predefinedNodes.length === 2) {
    predefinedEdges = [{
      id: PREDEFINED_EDGE_ID,
      source: SOURCE_NODE_ID,
      target: TARGET_NODE_ID,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2.5, stroke: normType === NORM_TYPES.ACTIVITY_FREQUENCY ? '#FFB02E' : '#577DFF' },
      label: edgeLabel,
      labelStyle: { fill: '#333', fontWeight: 500, fontSize: '12px' },
      labelBgStyle: { fill: 'rgba(255,255,255,0.7)', padding: '2px 4px', borderRadius: '2px' },
      labelBgPadding: [4, 2], // [y,x]
      labelBgBorderRadius: 2,
    }];
  }
  return { nodes: predefinedNodes, edges: predefinedEdges };
};


const GraphNormCreatorInternal: React.FC = () => {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState<CustomNodeData>([]);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState<AppEdge['data']>([]); // Specify edge data type
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<CustomNodeData, AppEdge['data']> | null>(null);

  const [createdNorms, setCreatedNorms] = useState<CreatedNorm[]>([]);
  const [selectedNormType, setSelectedNormType] = useState<NormTypeValue>(NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES);
  const [globalNormDetails, setGlobalNormDetails] = useState<GlobalNormDetails>(initialGlobalNormDetails);
  const [selectedElement, setSelectedElement] = useState<SelectedElementInfo>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const nonDeleteChanges = changes.filter(change => change.type !== 'remove');
      onNodesChangeInternal(nonDeleteChanges);
    },
    [onNodesChangeInternal]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const nonDeleteChanges = changes.filter(change => change.type !== 'remove');
      onEdgesChangeInternal(nonDeleteChanges);
    },
    [onEdgesChangeInternal]
  );

  // Effect to initialize/update nodes and edges when normType or initial details change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = getPredefinedNodesAndEdges(selectedNormType, globalNormDetails);
    setNodes(newNodes);
    setEdges(newEdges);
    setSelectedElement(null);
    setGlobalNormDetails(prev => ({
      ...initialGlobalNormDetails, // Reset specific fields
      avg_time_edge_label: selectedNormType === NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES ? (prev.df_type_prop_name || 'DF') : initialGlobalNormDetails.avg_time_edge_label,
      object_follows_edge_label: selectedNormType === NORM_TYPES.OBJECT_FOLLOWS_OBJECT ? (prev.object_follows_edge_label || 'DF_ENTITY') : initialGlobalNormDetails.object_follows_edge_label,
      activity_frequency_edge_label: selectedNormType === NORM_TYPES.ACTIVITY_FREQUENCY ? (prev.activity_frequency_edge_label || 'corr') : initialGlobalNormDetails.activity_frequency_edge_label,
      // Keep common user inputs
      norm_id: prev.norm_id,
      description: prev.description,
      weight: prev.weight,
      df_type_prop_name: selectedNormType === NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES ? prev.df_type_prop_name : '', // Clear if not relevant
      // Keep other relevant fields based on new normType if needed, or reset them
    }));

    if (reactFlowInstance && newNodes.length > 0) {
      setTimeout(() => reactFlowInstance.fitView({ padding: 0.25, duration: 300 }), 0);
    }
  }, [selectedNormType, setNodes, setEdges, reactFlowInstance]); // Removed globalNormDetails from here to avoid loop with next useEffect

  // Effect to update edge label specifically when relevant globalNormDetails change
  useEffect(() => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === PREDEFINED_EDGE_ID) {
          const newLabel = getInitialEdgeLabel(selectedNormType, globalNormDetails);
          return { ...edge, label: newLabel };
        }
        return edge;
      })
    );
  }, [selectedNormType, globalNormDetails.avg_time_edge_label, globalNormDetails.object_follows_edge_label, globalNormDetails.activity_frequency_edge_label, globalNormDetails.df_type_prop_name, setEdges]);


  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }) => {
    if (selNodes.length > 0) {
      const selectedNode = selNodes[0] as AppNode;
      setSelectedElement({ ...selectedNode, elementType: 'node' });
    } else if (selEdges.length > 0) {
      const selectedEdge = selEdges[0] as AppEdge;
      setSelectedElement({ ...selectedEdge, elementType: 'edge' });
    } else {
      setSelectedElement(null);
    }
  }, []);

  const handleGlobalDetailChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const targetType = e.target.type;

    setGlobalNormDetails(prev => {
      const newDetails = { ...prev, [name]: targetType === 'number' ? parseFloat(value) || 0 : value };
      // If df_type_prop_name is changed, also update avg_time_edge_label for immediate visual feedback
      if (name === 'df_type_prop_name' && selectedNormType === NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES) {
        newDetails.avg_time_edge_label = value || 'DF';
      }
      return newDetails;
    });
  };

  const handleNodeDataChange = (nodeId: string, field: keyof CustomNodeData, value: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const updatedData = { ...node.data, [field]: value };
          if (field === 'name') {
            updatedData.label = value || `Unnamed ${node.data.type}`;
          }
          return { ...node, data: updatedData };
        }
        return node;
      })
    );
    if (selectedElement && selectedElement.elementType === 'node' && selectedElement.id === nodeId) {
      setSelectedElement(prev => {
        if (!prev || prev.elementType !== 'node') return prev;
        const updatedData = { ...prev.data, [field]: value };
        if (field === 'name') {
          updatedData.label = value || `Unnamed ${prev.data.type}`;
        }
        return { ...prev, data: updatedData };
      });
    }
  };

  const addNormToList = () => {
    if (!globalNormDetails.norm_id || !globalNormDetails.description) {
      alert("Please fill in Norm ID and Description.");
      return;
    }
    const sourceNode = nodes.find(n => n.id === SOURCE_NODE_ID);
    const targetNode = nodes.find(n => n.id === TARGET_NODE_ID);

    if (!sourceNode || !targetNode || !sourceNode.data.name || !targetNode.data.name) {
      alert("Both nodes in the graph must have user-defined names. Select a node and set its name in the sidebar.");
      return;
    }

    const newNorm: Partial<CreatedNorm> = {
      norm_type: selectedNormType,
      norm_id: globalNormDetails.norm_id,
      description: globalNormDetails.description,
      weight: Number(globalNormDetails.weight) || 1.0,
    };
    const parseAggregationProps = (str: string): string[] => str ? str.split(',').map(s => s.trim()).filter(s => s) : [];

    switch (selectedNormType) {
      case NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES:
        if (!globalNormDetails.threshold_seconds || isNaN(parseFloat(globalNormDetails.threshold_seconds))) {
          alert("Threshold seconds (numeric) is required for AverageTimeBetweenActivitiesNorm."); return;
        }
        newNorm.activity_a = sourceNode.data.name;
        newNorm.activity_b = targetNode.data.name;
        newNorm.threshold_seconds = parseInt(globalNormDetails.threshold_seconds, 10);
        newNorm.aggregation_properties = parseAggregationProps(globalNormDetails.aggregation_properties);
        newNorm.df_type_prop_name = globalNormDetails.df_type_prop_name; // Use the specific data field
        if (globalNormDetails.df_type_prop_value) newNorm.df_type_prop_value = globalNormDetails.df_type_prop_value;
        break;
      case NORM_TYPES.OBJECT_FOLLOWS_OBJECT:
        newNorm.entity_type_a = sourceNode.data.name;
        newNorm.entity_type_b = targetNode.data.name;
        newNorm.entity_a_id_prop = globalNormDetails.entity_a_id_prop || 'ID';
        newNorm.aggregation_properties = parseAggregationProps(globalNormDetails.aggregation_properties);
        // Note: globalNormDetails.object_follows_edge_label is for display, not part of this norm's data structure
        break;
      case NORM_TYPES.ACTIVITY_FREQUENCY:
        if (!globalNormDetails.max_allowed_count || isNaN(parseFloat(globalNormDetails.max_allowed_count))) {
          alert("Max allowed count (numeric) is required for ActivityFrequencyNorm."); return;
        }
        newNorm.context_entity_type = sourceNode.data.name;
        newNorm.target_activity = targetNode.data.name;
        newNorm.context_entity_id_prop = globalNormDetails.context_entity_id_prop || 'ID';
        newNorm.max_allowed_count = parseInt(globalNormDetails.max_allowed_count, 10);
        newNorm.aggregation_properties = parseAggregationProps(globalNormDetails.aggregation_properties);
        // Note: globalNormDetails.activity_frequency_edge_label is for display
        break;
      default:
        const _exhaustiveCheck: never = selectedNormType;
        console.error("Unknown norm type for JSON generation:", _exhaustiveCheck);
        return;
    }
    setCreatedNorms(prev => [...prev, newNorm as CreatedNorm]);
    const { nodes: freshNodes, edges: freshEdges } = getPredefinedNodesAndEdges(selectedNormType, initialGlobalNormDetails); // Reset with initial edge labels
    setNodes(freshNodes);
    setEdges(freshEdges);
    setSelectedElement(null);
    setGlobalNormDetails(prev => ({ // Reset specific details, keep common ones if desired
      ...initialGlobalNormDetails,
      norm_id: '', // Clear norm_id for the next one
      description: '', // Clear description
      weight: prev.weight, // Optionally keep weight
    }));


    alert("Norm added!");
  };

  const memoizedNodeTypes = useMemo(() => ({ customNode: CustomNode }), []);

  return (
    <div className="graph-norm-creator-container">
      <div className="sidebar">
        <h2>Norm Configuration</h2>
        <div>
          <label htmlFor="normTypeSelect">Norm Type:</label>
          <select id="normTypeSelect" value={selectedNormType} onChange={(e) => setSelectedNormType(e.target.value as NormTypeValue)}>
            <option value={NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES}>Avg Time Between Activities</option>
            <option value={NORM_TYPES.OBJECT_FOLLOWS_OBJECT}>Object Follows Object</option>
            <option value={NORM_TYPES.ACTIVITY_FREQUENCY}>Activity Frequency</option>
          </select>
        </div>
        <div>
          <label htmlFor="normIdInput">Norm ID:</label>
          <input id="normIdInput" type="text" name="norm_id" value={globalNormDetails.norm_id} onChange={handleGlobalDetailChange} />
        </div>
        <div>
          <label htmlFor="descriptionInput">Description:</label>
          <input id="descriptionInput" type="text" name="description" value={globalNormDetails.description} onChange={handleGlobalDetailChange} />
        </div>
        <div>
          <label htmlFor="weightInput">Weight:</label>
          <input id="weightInput" type="number" name="weight" value={globalNormDetails.weight} onChange={handleGlobalDetailChange} step="0.1" min="0" />
        </div>

        {/* Norm-Specific and Edge Label Fields */}
        {selectedNormType === NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES && (
          <>
            <div><label htmlFor="thresholdInput">Threshold Seconds:</label><input id="thresholdInput" type="text" name="threshold_seconds" value={globalNormDetails.threshold_seconds} onChange={handleGlobalDetailChange} placeholder="e.g., 3600" /></div>
            <div><label htmlFor="dfTypeNameInput">DF Type Prop Name (for Norm Data & Edge Label):</label><input id="dfTypeNameInput" type="text" name="df_type_prop_name" value={globalNormDetails.df_type_prop_name} onChange={handleGlobalDetailChange} placeholder="e.g., EntityType (sets edge label)" /></div>
            <div><label htmlFor="dfTypeValueInput">DF Type Prop Value (Opt):</label><input id="dfTypeValueInput" type="text" name="df_type_prop_value" value={globalNormDetails.df_type_prop_value} onChange={handleGlobalDetailChange} /></div>
          </>
        )}
        {selectedNormType === NORM_TYPES.OBJECT_FOLLOWS_OBJECT && (
          <>
            <div><label htmlFor="entityAIdPropInput">Entity A ID Prop:</label><input id="entityAIdPropInput" type="text" name="entity_a_id_prop" value={globalNormDetails.entity_a_id_prop} onChange={handleGlobalDetailChange} /></div>
            <div><label htmlFor="objFollowsEdgeLabelInput">Edge Label (e.g., DF_ENTITY):</label><input id="objFollowsEdgeLabelInput" type="text" name="object_follows_edge_label" value={globalNormDetails.object_follows_edge_label} onChange={handleGlobalDetailChange} /></div>
          </>
        )}
        {selectedNormType === NORM_TYPES.ACTIVITY_FREQUENCY && (
          <>
            <div><label htmlFor="contextEntityIdPropInput">Context Entity ID Prop:</label><input id="contextEntityIdPropInput" type="text" name="context_entity_id_prop" value={globalNormDetails.context_entity_id_prop} onChange={handleGlobalDetailChange} /></div>
            <div><label htmlFor="maxCountInput">Max Allowed Count:</label><input id="maxCountInput" type="text" name="max_allowed_count" value={globalNormDetails.max_allowed_count} onChange={handleGlobalDetailChange} placeholder="e.g., 1" /></div>
            <div><label htmlFor="actFreqEdgeLabelInput">Edge Label (e.g., corr):</label><input id="actFreqEdgeLabelInput" type="text" name="activity_frequency_edge_label" value={globalNormDetails.activity_frequency_edge_label} onChange={handleGlobalDetailChange} /></div>
          </>
        )}
        <div>
          <label htmlFor="aggPropsInput">Aggregation Props (comma-sep):</label>
          <input id="aggPropsInput" type="text" name="aggregation_properties" value={globalNormDetails.aggregation_properties} onChange={handleGlobalDetailChange} />
        </div>

        <hr />
        <h3>Selected Node Properties</h3>
        {selectedElement && selectedElement.elementType === 'node' && (
          <div className="properties-panel">
            <p><b>Node Role:</b> {selectedElement.data.isSource ? 'Source / Left' : (selectedElement.data.isTarget ? 'Target / Right' : 'Node')}</p>
            <p><b>Type:</b> {selectedElement.data.type}</p>
            <label htmlFor={`nodeNameInput-${selectedElement.id}`}><b>Name / Identifier:</b></label>
            <AutocompleteInput
              inputId={`nodeNameInput-${selectedElement.id}`}
              value={selectedElement.data.name || ''}
              onChange={(newValue) => handleNodeDataChange(selectedElement.id, 'name', newValue)}
              suggestions={selectedElement.data.type === 'Activity' ? activityNames : entityNames}
              placeholder={`Enter ${selectedElement.data.type} Name`}
            />
          </div>
        )}
        {selectedElement && selectedElement.elementType === 'edge' && (
          <div className="properties-panel">
            <p><i>This is a predefined relationship. Its label is configured above.</i></p>
            <p><b>Current Label:</b> {selectedElement.label || '(empty)'}</p>
            <p><b>Source Node:</b> {nodes.find(n => n.id === selectedElement.source)?.data.name || selectedElement.source}</p>
            <p><b>Target Node:</b> {nodes.find(n => n.id === selectedElement.target)?.data.name || selectedElement.target}</p>
          </div>
        )}
        {!selectedElement && <p className="properties-panel-placeholder">Select a node to set its name.</p>}
        <hr />
        <button onClick={addNormToList} className="action-button">Add Current Configuration as Norm</button>
      </div>

      <div className="canvas-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onInit={setReactFlowInstance}
          onSelectionChange={onSelectionChange}
          nodeTypes={memoizedNodeTypes}
          fitView
          className="react-flow-canvas"
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          deleteKeyCode={null}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          zoomOnPinch={false}
        >
          <MiniMap nodeStrokeWidth={3} />
          <Controls showInteractive={false} />
          <Background gap={20} size={1.5} color="#e0e0e0" variant={BackgroundVariant.Dots} />
        </ReactFlow>
      </div>

      <div className="output-panel">
        <h2>Created Norms List ({createdNorms.length})</h2>
        {createdNorms.length === 0 ? <p>No norms defined yet.</p> :
          <ul>
            {createdNorms.map((norm, index) => (
              <li key={index}><strong>{norm.norm_id}</strong> ({norm.norm_type}): {norm.description}</li>
            ))}
          </ul>
        }
        <h2>Generated JSON Output</h2>
        <textarea
          readOnly
          value={JSON.stringify(createdNorms, null, 2)}
          rows={20}
          style={{ width: '100%', fontFamily: 'monospace', flexGrow: 1 }}
        />
      </div>
    </div>
  );
}

const GraphNormCreator: React.FC = () => (
  <ReactFlowProvider>
    <GraphNormCreatorInternal />
  </ReactFlowProvider>
);

export default GraphNormCreator;
