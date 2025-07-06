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
import TechnicalConfigurator, { Button, Input, Label } from './TechnicalConfiguration';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobalProcessConfig, initialGlobalProcessConfig } from './GlobalConfig';
import NormsTable from "./NormsTable";

// --- Constants and Type Definitions (Keep your existing ones) ---
const NORM_TYPES = {
  AVERAGE_TIME_BETWEEN_ACTIVITIES: 'AverageTimeBetweenActivitiesNorm',
  OBJECT_FOLLOWS_OBJECT: 'ObjectFollowsObjectNorm',
  ACTIVITY_FREQUENCY: 'ActivityFrequencyNorm',
  ACTIVITY_DIRECTLY_FOLLOWS: 'ActivityDirectlyFollowsNorm',
} as const;
type NormTypeValue = typeof NORM_TYPES[keyof typeof NORM_TYPES];

interface CustomNodeData {
  selected: any; label: string; type: string; name: string; icon?: string; isSource?: boolean; isTarget?: boolean;
}
type AppNode = Node<CustomNodeData>;
type AppEdge = Edge<{ label?: string }>;
interface GlobalNormDetails {
  norm_id: string; description: string; weight: number; threshold_seconds: string;
  max_allowed_count: string; aggregation_properties: string; avg_time_edge_label: string;
  object_follows_edge_label: string; activity_frequency_edge_label: string; forbidden?: boolean;
  df_type_prop_name: string; df_type_prop_value: string; check_existence: boolean;
}
export interface CreatedNorm {
  norm_type: string;
  norm_id: string;
  description: string;
  weight?: number;
  [key: string]: any;
}

const initialGlobalNormDetails: GlobalNormDetails = {
  norm_id: '', description: '', weight: 1.0, threshold_seconds: '', max_allowed_count: '',
  aggregation_properties: '', avg_time_edge_label: 'DF', object_follows_edge_label: 'DF_ENTITY',
  activity_frequency_edge_label: 'corr', df_type_prop_name: '', df_type_prop_value: '',
  check_existence: false,
};

const activityNames: string[] = ["Create PO", "Approve PO", "Receive Goods"];
const entityNames: string[] = ["Purchase Order", "Invoice", "Supplier"];

const SOURCE_NODE_ID = 'source-node';
const TARGET_NODE_ID = 'target-node';
const PREDEFINED_EDGE_ID = 'edge-1';

// --- CustomNode (Keep your existing implementation) ---
const CustomNode: React.FC<{ data: CustomNodeData, selected: boolean }> = ({ data, selected }) => {
  const nodeClasses = `custom-node ${data.type.toLowerCase()}-node ${selected ? 'selected' : ''} p-0 rounded-lg shadow-md border-2 bg-white dark:bg-gray-700`;
  const headerClasses = `custom-node-header px-3 py-2 border-b rounded-t-md flex items-center font-semibold text-xs uppercase tracking-wider
        ${data.type === 'Activity' || data.type === initialGlobalProcessConfig.eventNodeLabel ? 'bg-amber-100 dark:bg-amber-800 border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-200' : 'bg-sky-100 dark:bg-sky-800 border-sky-300 dark:border-sky-600 text-sky-700 dark:text-sky-200'}`;
  const bodyClasses = "custom-node-body p-3";
  const nameClasses = "node-name text-sm font-medium text-gray-800 dark:text-gray-100 break-words";
  const displayName = data.name || `Unnamed ${data.type}`;

  return (
    <div className={nodeClasses} style={{ borderColor: data.selected ? '#3b82f6' : (data.type === 'Activity' || data.type === initialGlobalProcessConfig.eventNodeLabel ? '#f59e0b' : '#0ea5e9') }}>
      <Handle type="target" position={Position.Left} className="!bg-gray-400 dark:!bg-gray-600 !w-3 !h-3 !border-2 !border-white dark:!border-gray-700" isConnectable={false} />
      <div className={headerClasses}>
        <span className="node-icon mr-2 text-base">{data.icon || (data.type === 'Activity' || data.type === initialGlobalProcessConfig.eventNodeLabel ? '⚙️' : '🧱')}</span>
        <span className="node-type-label">{data.type}</span>
      </div>
      <div className={bodyClasses}>
        <p className={nameClasses}>{displayName}</p>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-gray-400 dark:!bg-gray-600 !w-3 !h-3 !border-2 !border-white dark:!border-gray-700" isConnectable={false} />
    </div>
  );
};


const getInitialEdgeLabel = (normType: NormTypeValue, details: GlobalNormDetails, globalConfig: GlobalProcessConfig): string => {
  switch (normType) {
    case NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES:
    case NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS:
      return details.avg_time_edge_label || details.df_type_prop_name || globalConfig.dfBaseRelName || 'DF';
    case NORM_TYPES.OBJECT_FOLLOWS_OBJECT:
      return details.object_follows_edge_label || globalConfig.dfEntityRelName || 'DF_ENTITY';
    case NORM_TYPES.ACTIVITY_FREQUENCY:
      return details.activity_frequency_edge_label || globalConfig.corrRelName || 'corr';
    default: return '';
  }
};

const getPredefinedNodesAndEdges = (
  normType: NormTypeValue,
  details: GlobalNormDetails,
  globalConfig: GlobalProcessConfig
): { nodes: AppNode[]; edges: AppEdge[] } => {
  let predefinedNodes: AppNode[] = [];
  let predefinedEdges: AppEdge[] = [];
  const edgeLabel = getInitialEdgeLabel(normType, details, globalConfig);
  const activityTypeLabel = globalConfig.eventNodeLabel || 'Activity';
  const entityTypeLabel = globalConfig.entityNodeLabel || 'Entity';

  const sourceBaseData = { name: '', icon: '', label: '' };
  const targetBaseData = { name: '', icon: '', label: '' };

  switch (normType) {
    case NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES:
    case NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS:
      predefinedNodes = [
        {
          id: SOURCE_NODE_ID, type: 'customNode', data: {
            ...sourceBaseData, type: activityTypeLabel, icon: '⚙️', label: `${activityTypeLabel} A`, isSource: true,
            selected: undefined
          }, position: { x: 50, y: 150 }, draggable: true
        },
        {
          id: TARGET_NODE_ID, type: 'customNode', data: {
            ...targetBaseData, type: activityTypeLabel, icon: '⚙️', label: `${activityTypeLabel} B`, isTarget: true,
            selected: undefined
          }, position: { x: 350, y: 150 }, draggable: true
        },
      ];
      break;
    case NORM_TYPES.OBJECT_FOLLOWS_OBJECT:
      predefinedNodes = [
        {
          id: SOURCE_NODE_ID, type: 'customNode', data: {
            ...sourceBaseData, type: entityTypeLabel, icon: '🧱', label: `${entityTypeLabel} A`, isSource: true,
            selected: undefined
          }, position: { x: 50, y: 150 }, draggable: true
        },
        {
          id: TARGET_NODE_ID, type: 'customNode', data: {
            ...targetBaseData, type: entityTypeLabel, icon: '🧱', label: `${entityTypeLabel} B`, isTarget: true,
            selected: undefined
          }, position: { x: 350, y: 150 }, draggable: true
        },
      ];
      break;
    case NORM_TYPES.ACTIVITY_FREQUENCY:
      predefinedNodes = [
        {
          id: SOURCE_NODE_ID, type: 'customNode', data: {
            ...sourceBaseData, type: entityTypeLabel, icon: '🧱', label: `Context ${entityTypeLabel}`, isSource: true,
            selected: undefined
          }, position: { x: 50, y: 150 }, draggable: true
        },
        {
          id: TARGET_NODE_ID, type: 'customNode', data: {
            ...targetBaseData, type: activityTypeLabel, icon: '⚙️', label: `Target ${activityTypeLabel}`, isTarget: true,
            selected: undefined
          }, position: { x: 350, y: 150 }, draggable: true
        },
      ];
      break;
    default: predefinedNodes = [];
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
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 2,
    }];
  }
  return { nodes: predefinedNodes, edges: predefinedEdges };
};


interface GraphNormCreatorInternalProps {
  globalProcessConfig: GlobalProcessConfig;
  onBackToTechConfig: () => void;
}

const MIN_PANEL_WIDTH = 320; // px
const MAX_PANEL_WIDTH = 900; // px

const GraphNormCreatorInternal: React.FC<GraphNormCreatorInternalProps> = ({ globalProcessConfig, onBackToTechConfig }) => {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState<CustomNodeData>([]);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState<AppEdge['data']>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<CustomNodeData, AppEdge['data']> | null>(null);
  const [createdNorms, setCreatedNorms] = useState<CreatedNorm[]>([]);
  const [selectedNormType, setSelectedNormType] = useState<NormTypeValue>(NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES);
  const [currentGlobalNormDetails, setCurrentGlobalNormDetails] = useState<GlobalNormDetails>(initialGlobalNormDetails);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [thresholdCondition, setThresholdCondition] = useState<'less than' | 'greater than'>('less than');

  const [outputPanelWidth, setOutputPanelWidth] = useState(380);
  const resizing = useRef(false);
  const outputPanelRef = useRef<HTMLDivElement>(null);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const nonDeleteChanges = changes.filter(change => change.type !== 'remove');
    onNodesChangeInternal(nonDeleteChanges);
  }, [onNodesChangeInternal]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const nonDeleteChanges = changes.filter(change => change.type !== 'remove');
    onEdgesChangeInternal(nonDeleteChanges);
  }, [onEdgesChangeInternal]);

  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = getPredefinedNodesAndEdges(selectedNormType, currentGlobalNormDetails, globalProcessConfig);
    setNodes(newNodes);
    setEdges(newEdges);
    setSelectedElement(null);

    setCurrentGlobalNormDetails(prev => ({
      ...initialGlobalNormDetails,
      norm_id: prev.norm_id, description: prev.description, weight: prev.weight,
      avg_time_edge_label: selectedNormType === NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES ? (prev.avg_time_edge_label || globalProcessConfig.dfBaseRelName) : initialGlobalNormDetails.avg_time_edge_label,
      object_follows_edge_label: selectedNormType === NORM_TYPES.OBJECT_FOLLOWS_OBJECT ? (prev.object_follows_edge_label || globalProcessConfig.dfEntityRelName) : initialGlobalNormDetails.object_follows_edge_label,
      activity_frequency_edge_label: selectedNormType === NORM_TYPES.ACTIVITY_FREQUENCY ? (prev.activity_frequency_edge_label || globalProcessConfig.corrRelName) : initialGlobalNormDetails.activity_frequency_edge_label,
    }));

    if (reactFlowInstance && newNodes.length > 0) {
      setTimeout(() => reactFlowInstance.fitView({ padding: 0.2, duration: 300 }), 0);
    }
  }, [selectedNormType, globalProcessConfig, reactFlowInstance, setNodes, setEdges]);

  useEffect(() => {
    if (selectedNormType !== NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS) return;
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === PREDEFINED_EDGE_ID) {
          let label = getInitialEdgeLabel(selectedNormType, currentGlobalNormDetails, globalProcessConfig);
          let labelStyle = { fill: '#374151', fontWeight: '500', fontSize: '12px' };
          let style = { strokeWidth: 2, stroke: '#4f46e5' };
          if (currentGlobalNormDetails.forbidden) {
            label = `❌ ${label}`;
            labelStyle = { ...labelStyle, fill: '#dc2626', fontWeight: 'bold' };
            style = { ...style, stroke: '#dc2626' };
          }
          return { ...edge, label, labelStyle, style, markerEnd: { type: MarkerType.ArrowClosed, color: style.stroke }, };
        }
        return edge;
      })
    );
  }, [selectedNormType, currentGlobalNormDetails.forbidden, currentGlobalNormDetails.avg_time_edge_label, globalProcessConfig, setEdges,]);

  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: { nodes: AppNode[], edges: AppEdge[] }) => {
    if (selNodes.length > 0) setSelectedElement({ ...selNodes[0], elementType: 'node' });
    else if (selEdges.length > 0) setSelectedElement({ ...selEdges[0], elementType: 'edge' });
    else setSelectedElement(null);
  }, []);

  const handleGlobalDetailChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setCurrentGlobalNormDetails(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value),
    }));
  };

  const handleNodeDataChange = (nodeId: string, field: keyof CustomNodeData, value: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const updatedData = { ...node.data, [field]: value };
          if (field === 'name') {
            const nodeTypeLabel = node.data.type === (globalProcessConfig.eventNodeLabel || 'Activity') ? (globalProcessConfig.eventNodeLabel || 'Activity') : (globalProcessConfig.entityNodeLabel || 'Entity');
            updatedData.label = value || `Unnamed ${nodeTypeLabel}`;
          }
          return { ...node, data: updatedData };
        }
        return node;
      })
    );
    if (selectedElement && selectedElement.elementType === 'node' && selectedElement.id === nodeId) {
      setSelectedElement((prev: any) => {
        if (!prev || prev.elementType !== 'node') return prev;
        const updatedData = { ...prev.data, [field]: value };
        if (field === 'name') {
          const nodeTypeLabel = prev.data.type === (globalProcessConfig.eventNodeLabel || 'Activity') ? (globalProcessConfig.eventNodeLabel || 'Activity') : (globalProcessConfig.entityNodeLabel || 'Entity');
          updatedData.label = value || `Unnamed ${nodeTypeLabel}`;
        }
        return { ...prev, data: updatedData };
      });
    }
  };

  const validateNormDetails = (): boolean => {
    const sourceNode = nodes.find(n => n.id === SOURCE_NODE_ID);
    const targetNode = nodes.find(n => n.id === TARGET_NODE_ID);
    if (!sourceNode?.data?.name || !targetNode?.data?.name) {
      alert("Both source and target nodes in the graph must have a name. Select a node and set its name in the sidebar.");
      return false;
    }
    return true;
  };

  const addNormToList = () => {
    if (!validateNormDetails()) return;
    const sourceNode = nodes.find(n => n.id === SOURCE_NODE_ID)!;
    const targetNode = nodes.find(n => n.id === TARGET_NODE_ID)!;
    const normId = currentGlobalNormDetails.norm_id || `${selectedNormType}-${Date.now()}`;
    const activityLabel = globalProcessConfig.eventNodeLabel || "Activity";
    const entityLabel = globalProcessConfig.entityNodeLabel || "Entity";
    const description = currentGlobalNormDetails.description || (() => {
      switch (selectedNormType) {
        case NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES:
          return `Avg. time between ${activityLabel.toLowerCase()} "${sourceNode.data.name}" and "${targetNode.data.name}" should be ${thresholdCondition} ${currentGlobalNormDetails.threshold_seconds}s.`;
        case NORM_TYPES.OBJECT_FOLLOWS_OBJECT:
          return `${entityLabel} "${sourceNode.data.name}" should follow ${entityLabel.toLowerCase()} "${targetNode.data.name}".`;
        case NORM_TYPES.ACTIVITY_FREQUENCY:
          return `${activityLabel} "${targetNode.data.name}" should occur ${currentGlobalNormDetails.check_existence ? 'at least once' : `at most ${currentGlobalNormDetails.max_allowed_count} times`} in context of ${entityLabel.toLowerCase()} "${sourceNode.data.name}".`;
        case NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS:
          return currentGlobalNormDetails.forbidden
            ? `It is forbidden for "${sourceNode.data.name}" to be directly followed by "${targetNode.data.name}".`
            : `"${sourceNode.data.name}" should be directly followed by "${targetNode.data.name}".`;
        default: return "Custom norm description.";
      }
    })();

    const newNorm: Partial<CreatedNorm> = {
      norm_type: selectedNormType, norm_id: normId, description: description,
      weight: Number(currentGlobalNormDetails.weight) || 1.0,
    };
    const parseAggregationProps = (str: string): string[] => str ? str.split(',').map(s => s.trim()).filter(s => s) : [];
    switch (selectedNormType) {
      case NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES:
        Object.assign(newNorm, {
          activity_a: sourceNode.data.name, activity_b: targetNode.data.name,
          threshold_seconds: parseInt(currentGlobalNormDetails.threshold_seconds, 10),
          threshold_condition: thresholdCondition,
          aggregation_properties: parseAggregationProps(currentGlobalNormDetails.aggregation_properties),
          ...(currentGlobalNormDetails.df_type_prop_value && { df_type_prop_value: currentGlobalNormDetails.df_type_prop_value })
        });
        break;
      case NORM_TYPES.OBJECT_FOLLOWS_OBJECT:
        Object.assign(newNorm, {
          entity_type_a: sourceNode.data.name, entity_type_b: targetNode.data.name,
          aggregation_properties: parseAggregationProps(currentGlobalNormDetails.aggregation_properties),
        });
        break;
      case NORM_TYPES.ACTIVITY_FREQUENCY:
        Object.assign(newNorm, {
          context_entity_type: sourceNode.data.name, target_activity: targetNode.data.name,
          max_allowed_count: parseInt(currentGlobalNormDetails.max_allowed_count, 10),
          check_existence: currentGlobalNormDetails.check_existence,
          aggregation_properties: parseAggregationProps(currentGlobalNormDetails.aggregation_properties),
        });
        break;
      case NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS:
        Object.assign(newNorm, {
          activity_a: sourceNode.data.name, activity_b: targetNode.data.name,
          forbidden: !!currentGlobalNormDetails.forbidden,
        });
        break;
    }
    setCreatedNorms(prev => [...prev, newNorm as CreatedNorm]);
    alert("Norm added!");
  };

  const memoizedNodeTypes = useMemo(() => ({ customNode: CustomNode }), []);

  // --- Resizer Logic ---
  const handleWindowMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing.current || !outputPanelRef.current) {
      return;
    }
    // The right edge of the output panel is determined by its container's right edge,
    // which, if the main container is w-screen, is window.innerWidth.
    // getBoundingClientRect().right of the panel itself also works here as it's the rightmost flex item.
    const panelHost = outputPanelRef.current.parentElement;
    if (!panelHost) return;

    const panelHostRect = panelHost.getBoundingClientRect();
    const containerRight = panelHostRect.right; // Right edge of the container holding the panel

    // The new width is the distance from the container's right edge to the mouse position
    let newWidth = containerRight - e.clientX;

    newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth));
    setOutputPanelWidth(newWidth);
  }, [setOutputPanelWidth]); // MIN_PANEL_WIDTH and MAX_PANEL_WIDTH are constants

  const handleWindowMouseUp = useCallback(() => {
    if (resizing.current) {
      resizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = ''; // Re-enable text selection
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    }
  }, [handleWindowMouseMove]); // Include handleWindowMouseMove as it's called

  const handleResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default drag behavior like text selection
    resizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Disable text selection during resize

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  }, [handleWindowMouseMove, handleWindowMouseUp]); // Add dependencies

  // Remove the old useEffect that was managing these listeners
  // useEffect(() => {
  //   if (resizing.current) { ... }
  // });

  return (
    <div className="graph-norm-creator-container flex flex-row h-screen w-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="sidebar w-[380px] min-w-[350px] p-5 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Norm Configuration</h2>
          <Button onClick={onBackToTechConfig} variant="outline" className="text-xs">
            Edit Tech Config
          </Button>
        </div>
        <div className="mb-4">
          <Label htmlFor="normTypeSelect">Norm Type:</Label>
          <select id="normTypeSelect" value={selectedNormType}
            onChange={(e) => setSelectedNormType(e.target.value as NormTypeValue)}
            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value={NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES}>Avg Time Between {globalProcessConfig.eventNodeLabel}s</option>
            <option value={NORM_TYPES.OBJECT_FOLLOWS_OBJECT}>{globalProcessConfig.entityNodeLabel} Follows {globalProcessConfig.entityNodeLabel}</option>
            <option value={NORM_TYPES.ACTIVITY_FREQUENCY}>{globalProcessConfig.eventNodeLabel} Frequency</option>
            <option value={NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS}>Activity Directly Follows</option>
          </select>
        </div>
        <div className="mb-4"><Label htmlFor="normIdInput">Norm ID (Optional):</Label><Input id="normIdInput" type="text" name="norm_id" value={currentGlobalNormDetails.norm_id} onChange={handleGlobalDetailChange} /></div>
        <div className="mb-4"><Label htmlFor="descriptionInput">Description (Optional):</Label><Input id="descriptionInput" type="text" name="description" value={currentGlobalNormDetails.description} onChange={handleGlobalDetailChange} /></div>
        <div className="mb-4"><Label htmlFor="weightInput">Weight:</Label><Input id="weightInput" type="number" name="weight" value={currentGlobalNormDetails.weight} onChange={handleGlobalDetailChange} step="0.1" min="0" /></div>
        {selectedNormType === NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES && (
          <>
            <div className="mb-2"><Label htmlFor="thresholdInput">Threshold Seconds:</Label><Input id="thresholdInput" type="text" name="threshold_seconds" value={currentGlobalNormDetails.threshold_seconds} onChange={handleGlobalDetailChange} placeholder="e.g., 3600" /></div>
            <div className="mb-2">
              <Label htmlFor="thresholdCondition">Threshold Condition:</Label>
              <select id="thresholdCondition" value={thresholdCondition} onChange={(e) => setThresholdCondition(e.target.value as 'less than' | 'greater than')} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                <option value="less than">Less than</option><option value="greater than">Greater than</option>
              </select>
            </div>
          </>
        )}
        {selectedNormType === NORM_TYPES.ACTIVITY_FREQUENCY && (
          <>
            <div className="mb-2"><Label htmlFor="checkExistenceInput" className="flex items-center"><Input id="checkExistenceInput" type="checkbox" name="check_existence" checked={currentGlobalNormDetails.check_existence} onChange={handleGlobalDetailChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded mr-2" /> Check Existence (ignore count)</Label></div>
            <div className="mb-4"><Label htmlFor="maxCountInput">Max Allowed Count (if not checking existence):</Label><Input id="maxCountInput" type="text" name="max_allowed_count" value={currentGlobalNormDetails.max_allowed_count} onChange={handleGlobalDetailChange} placeholder="e.g., 1" disabled={currentGlobalNormDetails.check_existence} /></div>
          </>
        )}
        {selectedNormType === NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS && (
          <div className="mb-4">
            <Label htmlFor="adfTypeSelect">Constraint:</Label>
            <select
              id="adfTypeSelect"
              value={currentGlobalNormDetails.forbidden ? "forbidden" : "allowed"}
              onChange={e => setCurrentGlobalNormDetails(prev => ({ ...prev, forbidden: e.target.value === "forbidden" }))}
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
            >
              <option value="allowed">These activities should happen one after another</option>
              <option value="forbidden">These activities should NOT happen one after another</option>
            </select>
          </div>
        )}
        <div className="mb-6"><Label htmlFor="aggPropsInput">Aggregation Props (comma-sep):</Label><Input id="aggPropsInput" type="text" name="aggregation_properties" value={currentGlobalNormDetails.aggregation_properties} onChange={handleGlobalDetailChange} /></div>
        <hr className="my-6 border-gray-200 dark:border-gray-700" />
        <h3 className="text-lg font-semibold mb-3">Selected Node Properties</h3>
        {selectedElement && selectedElement.elementType === 'node' ? (
          <div className="properties-panel p-4 bg-gray-50 dark:bg-gray-750 rounded-md border border-gray-200 dark:border-gray-600">
            <p className="text-sm mb-1"><b>Node Role:</b> {selectedElement.data.isSource ? 'Source / Left' : (selectedElement.data.isTarget ? 'Target / Right' : 'Node')}</p>
            <p className="text-sm mb-3"><b>Type:</b> {selectedElement.data.type}</p>
            <Label htmlFor={`nodeNameInput-${selectedElement.id}`}><b>Name / Identifier (Value of '{selectedElement.data.type === (globalProcessConfig.eventNodeLabel || 'Activity') ? globalProcessConfig.activityProperty : globalProcessConfig.entityFilterProperty}') :</b></Label>
            <AutocompleteInput
              inputId={`nodeNameInput-${selectedElement.id}`}
              value={selectedElement.data.name || ''}
              onChange={(newValue) => handleNodeDataChange(selectedElement.id, 'name', newValue)}
              suggestions={selectedElement.data.type === (globalProcessConfig.eventNodeLabel || 'Activity') ? activityNames : entityNames}
              placeholder={`Enter Name for this ${selectedElement.data.type}`}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">Select a node to set its name.</p>
        )}
        <hr className="my-6 border-gray-200 dark:border-gray-700" />
        <Button onClick={addNormToList} className="w-full">Add Current Configuration as Norm</Button>
      </div>

      <div className="canvas-container flex-grow relative h-full border-l border-r border-gray-200 dark:border-gray-700">
        <ReactFlow
          nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onInit={setReactFlowInstance} onSelectionChange={onSelectionChange}
          nodeTypes={memoizedNodeTypes} fitView
          className="bg-gray-50 dark:bg-gray-850"
          nodesDraggable={false} nodesConnectable={false} elementsSelectable={true}
          deleteKeyCode={null} panOnDrag={false} zoomOnScroll={false} zoomOnDoubleClick={false} zoomOnPinch={false}
        >
          <MiniMap nodeStrokeWidth={3} className="!bg-white dark:!bg-gray-700 !border-gray-300 dark:!border-gray-600" />
          <Controls className="!shadow-lg !rounded-md !border-gray-300 dark:!border-gray-600" />
          <Background gap={20} size={1} color="#cbd5e1" variant={BackgroundVariant.Dots} />
        </ReactFlow>
      </div>
      <div
        className="resizer cursor-col-resize w-2 bg-gray-300 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-700 transition-colors duration-150" // Added hover style
        style={{ zIndex: 20 }}
        onMouseDown={handleResizerMouseDown} // Use the correct mouseDown handler
      />
      <div
        ref={outputPanelRef}
        className="output-panel" // Ensure this class doesn't conflict with Tailwind (e.g., if it sets fixed width)
        style={{ width: `${outputPanelWidth}px`, minWidth: `${MIN_PANEL_WIDTH}px`, maxWidth: `${MAX_PANEL_WIDTH}px` }} // Ensure units are applied
      >
        <div className="w-full h-full p-5 bg-white dark:bg-gray-800 overflow-y-auto shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Created Norms ({createdNorms.length})</h2>
          </div>
          <NormsTable norms={createdNorms} />
          <h2 className="text-xl font-semibold mt-6 mb-3">Generated JSON Output</h2>
          <textarea
            readOnly
            value={JSON.stringify({ config: globalProcessConfig, norms: createdNorms, }, null, 2)}
            rows={15}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-xs font-mono"
          />
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [globalProcessConfig, setGlobalProcessConfig] = useState<GlobalProcessConfig>(initialGlobalProcessConfig);
  const [isTechConfigMode, setIsTechConfigMode] = useState(true);

  useEffect(() => {
    const savedConfig = localStorage.getItem('globalProcessConfig');
    if (savedConfig) {
      try {
        setGlobalProcessConfig(JSON.parse(savedConfig));
        setIsTechConfigMode(false);
      } catch (error) {
        console.error("Failed to parse saved config:", error);
        localStorage.removeItem('globalProcessConfig');
      }
    }
  }, []);

  const handleConfigSave = (newConfig: GlobalProcessConfig) => {
    setGlobalProcessConfig(newConfig);
    localStorage.setItem('globalProcessConfig', JSON.stringify(newConfig));
    setIsTechConfigMode(false);
  };

  const handleBackToTechConfig = () => {
    setIsTechConfigMode(true);
  };

  if (isTechConfigMode) {
    return <TechnicalConfigurator currentConfig={globalProcessConfig} onConfigSave={handleConfigSave} onCancel={globalProcessConfig !== initialGlobalProcessConfig ? () => setIsTechConfigMode(false) : undefined} />;
  }

  return (
    <ReactFlowProvider>
      <GraphNormCreatorInternal globalProcessConfig={globalProcessConfig} onBackToTechConfig={handleBackToTechConfig} />
    </ReactFlowProvider>
  );
};

export default App;