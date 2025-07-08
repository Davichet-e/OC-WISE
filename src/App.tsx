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
import TechnicalConfigurator, { Button, Input, Label, Tooltip, InfoIcon } from './TechnicalConfiguration';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobalProcessConfig, initialGlobalProcessConfig } from './GlobalConfig';
import NormsTable from "./NormsTable";

// --- Constants and Type Definitions ---
const NORM_TYPES = {
  AVERAGE_TIME_BETWEEN_ACTIVITIES: 'AverageTimeBetweenActivitiesNorm',
  ENTITY_FOLLOWS_ENTITY: 'EntityFollowsEntityNorm',
  EVENT_TO_ENTITY_RELATIONSHIP: 'EventToEntityRelationshipNorm',
  ACTIVITY_DIRECTLY_FOLLOWS: 'ActivityDirectlyFollowsNorm',
  EVENT_PROPERTY_VALUE: 'EventPropertyValueNorm',
  ENTITY_PROPERTY_VALUE: 'EntityPropertyValueNorm',
} as const;
type NormTypeValue = typeof NORM_TYPES[keyof typeof NORM_TYPES];

interface CustomNodeData {
  selected: any; label: string; type: string; name: string; icon?: string; isSource?: boolean; isTarget?: boolean;
}
type AppNode = Node<CustomNodeData>;
type AppEdge = Edge<{ label?: string }>;

interface GlobalNormDetails {
  norm_id: string; description: string; weight: number; threshold_seconds: string;
  aggregation_properties: string; avg_time_edge_label: string;
  entity_follows_edge_label: string; activity_frequency_edge_label: string; forbidden?: boolean;
  df_type_prop_name: string; df_type_prop_value: string;
  // Fields for EventToEntityRelationshipNorm
  e2o_operator: 'exists' | 'not exists' | '==' | '!=' | '>' | '<' | '>=' | '<=';
  e2o_count: string;
  // Fields for PropertyValueNorms
  property_name: string;
  property_data_type: 'string' | 'number';
  property_operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not in';
  property_value: string;
}

export interface CreatedNorm {
  norm_type: string;
  norm_id: string;
  description: string;
  weight?: number;
  [key: string]: any;
}

const initialGlobalNormDetails: GlobalNormDetails = {
  norm_id: '', description: '', weight: 1.0, threshold_seconds: '',
  aggregation_properties: '', avg_time_edge_label: 'DF', entity_follows_edge_label: 'DF_ENTITY',
  activity_frequency_edge_label: 'corr', df_type_prop_name: '', df_type_prop_value: '',
  e2o_operator: '>=', e2o_count: '1', forbidden: false,
  property_name: '', property_data_type: 'string', property_operator: 'in', property_value: '',
};

const activityNames: string[] = ["Create PO", "Approve PO", "Receive Goods", "Create Invoice", "Approve Invoice", "Pay Invoice"];
const entityNames: string[] = ["Purchase Order", "Invoice", "Supplier", "Goods Receipt"];

const SINGLE_NODE_ID = 'single-node';
const SOURCE_NODE_ID = 'source-node';
const TARGET_NODE_ID = 'target-node';
const PREDEFINED_EDGE_ID = 'edge-1';

// --- CustomNode ---
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
    case NORM_TYPES.ENTITY_FOLLOWS_ENTITY:
      return details.entity_follows_edge_label || globalConfig.dfEntityRelName || 'DF_ENTITY';
    case NORM_TYPES.EVENT_TO_ENTITY_RELATIONSHIP:
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
  const singleBaseData = { name: '', icon: '', label: '' };


  switch (normType) {
    case NORM_TYPES.EVENT_PROPERTY_VALUE:
      predefinedNodes = [{
        id: SINGLE_NODE_ID, type: 'customNode',
        data: { ...singleBaseData, type: activityTypeLabel, icon: '⚙️', label: `Target ${activityTypeLabel}`, selected: undefined },
        position: { x: 200, y: 150 }, draggable: true
      }];
      break;

    case NORM_TYPES.ENTITY_PROPERTY_VALUE:
      predefinedNodes = [{
        id: SINGLE_NODE_ID, type: 'customNode',
        data: { ...singleBaseData, type: entityTypeLabel, icon: '🧱', label: `Target ${entityTypeLabel}`, selected: undefined },
        position: { x: 200, y: 150 }, draggable: true
      }];
      break;

    case NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES:
    case NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS:
      predefinedNodes = [
        {
          id: SOURCE_NODE_ID, type: 'customNode', data: {
            ...sourceBaseData, type: activityTypeLabel, icon: '⚙️', label: `${activityTypeLabel} A`, isSource: true, selected: undefined
          }, position: { x: 50, y: 150 }, draggable: true
        },
        {
          id: TARGET_NODE_ID, type: 'customNode', data: {
            ...targetBaseData, type: activityTypeLabel, icon: '⚙️', label: `${activityTypeLabel} B`, isTarget: true, selected: undefined
          }, position: { x: 350, y: 150 }, draggable: true
        },
      ];
      break;
    case NORM_TYPES.ENTITY_FOLLOWS_ENTITY:
      predefinedNodes = [
        {
          id: SOURCE_NODE_ID, type: 'customNode', data: {
            ...sourceBaseData, type: entityTypeLabel, icon: '🧱', label: `${entityTypeLabel} A`, isSource: true, selected: undefined
          }, position: { x: 50, y: 150 }, draggable: true
        },
        {
          id: TARGET_NODE_ID, type: 'customNode', data: {
            ...targetBaseData, type: entityTypeLabel, icon: '🧱', label: `${entityTypeLabel} B`, isTarget: true, selected: undefined
          }, position: { x: 350, y: 150 }, draggable: true
        },
      ];
      break;
    case NORM_TYPES.EVENT_TO_ENTITY_RELATIONSHIP:
      predefinedNodes = [
        {
          id: SOURCE_NODE_ID, type: 'customNode', data: {
            ...sourceBaseData, type: entityTypeLabel, icon: '🧱', label: `Context ${entityTypeLabel}`, isSource: true, selected: undefined
          }, position: { x: 50, y: 150 }, draggable: true
        },
        {
          id: TARGET_NODE_ID, type: 'customNode', data: {
            ...targetBaseData, type: activityTypeLabel, icon: '⚙️', label: `Target ${activityTypeLabel}`, isTarget: true, selected: undefined
          }, position: { x: 350, y: 150 }, draggable: true
        },
      ];
      break;
    default: predefinedNodes = [];
  }

  if (predefinedNodes.length === 2) {
    predefinedEdges = [{
      id: PREDEFINED_EDGE_ID, source: SOURCE_NODE_ID, target: TARGET_NODE_ID, type: 'smoothstep', animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2.5, stroke: normType === NORM_TYPES.EVENT_TO_ENTITY_RELATIONSHIP ? '#FFB02E' : '#577DFF' },
      label: edgeLabel, labelStyle: { fill: '#333', fontWeight: 500, fontSize: '12px' },
      labelBgStyle: { fill: 'rgba(255,255,255,0.7)', padding: '2px 4px', borderRadius: '2px' },
      labelBgPadding: [4, 2], labelBgBorderRadius: 2,
    }];
  }
  return { nodes: predefinedNodes, edges: predefinedEdges };
};


interface GraphNormCreatorInternalProps {
  globalProcessConfig: GlobalProcessConfig;
  onBackToTechConfig: () => void;
}

const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 900;

const GraphNormCreatorInternal: React.FC<GraphNormCreatorInternalProps> = ({ globalProcessConfig, onBackToTechConfig }) => {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState<CustomNodeData>([]);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState<AppEdge['data']>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<CustomNodeData, AppEdge['data']> | null>(null);
  const [createdNorms, setCreatedNorms] = useState<CreatedNorm[]>([]);
  const [selectedNormType, setSelectedNormType] = useState<NormTypeValue>(NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES);
  const [currentGlobalNormDetails, setCurrentGlobalNormDetails] = useState<GlobalNormDetails>(initialGlobalNormDetails);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [thresholdCondition, setThresholdCondition] = useState<'less than' | 'greater than'>('less than');
  const [analysisResults, setAnalysisResults] = useState<string>('');
  const [isAnalysisRunning, setIsAnalysisRunning] = useState<boolean>(false);

  const [outputPanelWidth, setOutputPanelWidth] = useState(420);
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
      ...initialGlobalNormDetails, norm_id: prev.norm_id, description: prev.description, weight: prev.weight,
      avg_time_edge_label: selectedNormType === NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES ? (prev.avg_time_edge_label || globalProcessConfig.dfBaseRelName) : initialGlobalNormDetails.avg_time_edge_label,
      entity_follows_edge_label: selectedNormType === NORM_TYPES.ENTITY_FOLLOWS_ENTITY ? (prev.entity_follows_edge_label || globalProcessConfig.dfEntityRelName) : initialGlobalNormDetails.entity_follows_edge_label,
      activity_frequency_edge_label: selectedNormType === NORM_TYPES.EVENT_TO_ENTITY_RELATIONSHIP ? (prev.activity_frequency_edge_label || globalProcessConfig.corrRelName) : initialGlobalNormDetails.activity_frequency_edge_label,
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
    const isTwoNodeNorm = [
      NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES as string,
      NORM_TYPES.ENTITY_FOLLOWS_ENTITY,
      NORM_TYPES.EVENT_TO_ENTITY_RELATIONSHIP,
      NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS
    ].includes(selectedNormType);

    const isOneNodeNorm = [
      NORM_TYPES.EVENT_PROPERTY_VALUE as string,
      NORM_TYPES.ENTITY_PROPERTY_VALUE
    ].includes(selectedNormType);

    if (isTwoNodeNorm) {
      const sourceNode = nodes.find(n => n.id === SOURCE_NODE_ID);
      const targetNode = nodes.find(n => n.id === TARGET_NODE_ID);
      if (!sourceNode?.data?.name || !targetNode?.data?.name) {
        alert("Both source and target nodes in the graph must have a name. Select a node and set its name in the sidebar.");
        return false;
      }
    }

    if (isOneNodeNorm) {
      const singleNode = nodes.find(n => n.id === SINGLE_NODE_ID);
      if (!singleNode?.data?.name) {
        alert("The target node in the graph must have a name. Select the node and set its name in the sidebar.");
        return false;
      }
      if (!currentGlobalNormDetails.property_name || !currentGlobalNormDetails.property_value) {
        alert("Please specify the property name and the value to check against in the sidebar.");
        return false;
      }
    }
    return true;
  };


  const addNormToList = () => {
    if (!validateNormDetails()) return;

    const sourceNode = nodes.find(n => n.id === SOURCE_NODE_ID);
    const targetNode = nodes.find(n => n.id === TARGET_NODE_ID);
    const singleNode = nodes.find(n => n.id === SINGLE_NODE_ID);

    const normId = currentGlobalNormDetails.norm_id || `${selectedNormType}-${Date.now()}`;
    const activityLabel = globalProcessConfig.eventNodeLabel || "Activity";
    const entityLabel = globalProcessConfig.entityNodeLabel || "Entity";

    const description = currentGlobalNormDetails.description || (() => {
      switch (selectedNormType) {
        case NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES:
          return `Avg. time between ${activityLabel.toLowerCase()} "${sourceNode!.data.name}" and "${targetNode!.data.name}" should be ${thresholdCondition} ${currentGlobalNormDetails.threshold_seconds}s.`;
        case NORM_TYPES.ENTITY_FOLLOWS_ENTITY:
          return `${entityLabel} "${sourceNode!.data.name}" should follow ${entityLabel.toLowerCase()} "${targetNode!.data.name}".`;
        case NORM_TYPES.EVENT_TO_ENTITY_RELATIONSHIP:
          const relOp = currentGlobalNormDetails.e2o_operator;
          const relCount = currentGlobalNormDetails.e2o_count;
          let relDesc = '';
          if (relOp === 'exists') relDesc = 'at least one';
          else if (relOp === 'not exists') relDesc = 'zero';
          else relDesc = `${relOp} ${relCount}`;
          return `${activityLabel} "${targetNode!.data.name}" should be related to ${entityLabel.toLowerCase()} "${sourceNode!.data.name}" ${relDesc} time(s).`;
        case NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS:
          return currentGlobalNormDetails.forbidden
            ? `It is forbidden for "${sourceNode!.data.name}" to be directly followed by "${targetNode!.data.name}".`
            : `"${sourceNode!.data.name}" should be directly followed by "${targetNode!.data.name}".`;
        case NORM_TYPES.EVENT_PROPERTY_VALUE:
          return `${activityLabel} "${singleNode!.data.name}" must have property "${currentGlobalNormDetails.property_name}" ${currentGlobalNormDetails.property_operator} "${currentGlobalNormDetails.property_value}".`;
        case NORM_TYPES.ENTITY_PROPERTY_VALUE:
          return `${entityLabel} "${singleNode!.data.name}" must have property "${currentGlobalNormDetails.property_name}" ${currentGlobalNormDetails.property_operator} "${currentGlobalNormDetails.property_value}".`;
        default: return "Custom norm description.";
      }
    })();

    const newNorm: Partial<CreatedNorm> = {
      norm_type: selectedNormType, norm_id: normId, description: description,
      weight: Number(currentGlobalNormDetails.weight) || 1.0,
      attributeStorage: globalProcessConfig.attributeStorage,
    };
    const parseAggregationProps = (str: string): string[] => str ? str.split(',').map(s => s.trim()).filter(s => s) : [];

    switch (selectedNormType) {
      case NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES:
        Object.assign(newNorm, {
          activity_a: sourceNode!.data.name, activity_b: targetNode!.data.name,
          threshold_seconds: parseInt(currentGlobalNormDetails.threshold_seconds, 10),
          threshold_condition: thresholdCondition,
          aggregation_properties: parseAggregationProps(currentGlobalNormDetails.aggregation_properties),
          ...(currentGlobalNormDetails.df_type_prop_value && { df_type_prop_value: currentGlobalNormDetails.df_type_prop_value })
        });
        break;
      case NORM_TYPES.ENTITY_FOLLOWS_ENTITY:
        Object.assign(newNorm, {
          entity_type_a: sourceNode!.data.name, entity_type_b: targetNode!.data.name,
          aggregation_properties: parseAggregationProps(currentGlobalNormDetails.aggregation_properties),
        });
        break;
      case NORM_TYPES.EVENT_TO_ENTITY_RELATIONSHIP:
        Object.assign(newNorm, {
          context_entity_type: sourceNode!.data.name,
          target_activity: targetNode!.data.name,
          operator: currentGlobalNormDetails.e2o_operator,
          count: ['exists', 'not exists'].includes(currentGlobalNormDetails.e2o_operator) ? (currentGlobalNormDetails.e2o_operator === 'exists' ? 1 : 0) : parseInt(currentGlobalNormDetails.e2o_count, 10),
          aggregation_properties: parseAggregationProps(currentGlobalNormDetails.aggregation_properties),
        });
        break;
      case NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS:
        Object.assign(newNorm, {
          activity_a: sourceNode!.data.name, activity_b: targetNode!.data.name,
          forbidden: !!currentGlobalNormDetails.forbidden,
        });
        break;
      case NORM_TYPES.EVENT_PROPERTY_VALUE:
      case NORM_TYPES.ENTITY_PROPERTY_VALUE:
        Object.assign(newNorm, {
          target_name: singleNode!.data.name,
          property_name: currentGlobalNormDetails.property_name,
          operator: currentGlobalNormDetails.property_operator,
          value: currentGlobalNormDetails.property_data_type === 'number'
            ? parseFloat(currentGlobalNormDetails.property_value)
            : currentGlobalNormDetails.property_value.split(',').map(s => s.trim()),
          aggregation_properties: parseAggregationProps(currentGlobalNormDetails.aggregation_properties),
        });
        break;
    }
    setCreatedNorms(prev => [...prev, newNorm as CreatedNorm]);
    alert("Norm added!");
  };

  const handleRunAnalysis = async () => {
    if (createdNorms.length === 0) {
      alert("Please add at least one norm before running the analysis.");
      return;
    }
    setIsAnalysisRunning(true);
    setAnalysisResults('Running analysis...');

    const payload = {
      config: globalProcessConfig,
      norms: createdNorms,
    };

    try {
      const response = await fetch('http://localhost:8000/api/run-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAnalysisResults(data.results);
    } catch (error: any) {
      console.error("Failed to run analysis:", error);
      setAnalysisResults(`Error: ${error.message}`);
    } finally {
      setIsAnalysisRunning(false);
    }
  };

  const memoizedNodeTypes = useMemo(() => ({ customNode: CustomNode }), []);

  // --- Resizer Logic ---
  const handleWindowMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing.current || !outputPanelRef.current) return;
    const panelHost = outputPanelRef.current.parentElement;
    if (!panelHost) return;
    const containerRight = panelHost.getBoundingClientRect().right;
    let newWidth = containerRight - e.clientX;
    newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth));
    setOutputPanelWidth(newWidth);
  }, []);

  const handleWindowMouseUp = useCallback(() => {
    if (resizing.current) {
      resizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    }
  }, [handleWindowMouseMove]);

  const handleResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  }, [handleWindowMouseMove, handleWindowMouseUp]);

  return (
    <div className="graph-norm-creator-container flex flex-row h-screen w-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="sidebar w-[380px] min-w-[350px] p-5 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Norm Configuration</h2>
          <Button onClick={onBackToTechConfig} variant="default" className="text-xs">
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
            <option value={NORM_TYPES.ENTITY_FOLLOWS_ENTITY}>{globalProcessConfig.entityNodeLabel} Follows {globalProcessConfig.entityNodeLabel}</option>
            <option value={NORM_TYPES.EVENT_TO_ENTITY_RELATIONSHIP}>Event-to-Entity Relationship</option>
            <option value={NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS}>{globalProcessConfig.eventNodeLabel} Directly Follows</option>
            <option value={NORM_TYPES.EVENT_PROPERTY_VALUE}>{globalProcessConfig.eventNodeLabel} Property Value</option>
            <option value={NORM_TYPES.ENTITY_PROPERTY_VALUE}>{globalProcessConfig.entityNodeLabel} Property Value</option>
          </select>
        </div>

        <div className="space-y-4">
          <div><Label htmlFor="normIdInput">Norm ID (Optional):</Label><Input id="normIdInput" type="text" name="norm_id" value={currentGlobalNormDetails.norm_id} onChange={handleGlobalDetailChange} placeholder="e.g., CheckPOValue" /></div>
          <div><Label htmlFor="descriptionInput">Description (Optional):</Label><Input id="descriptionInput" type="text" name="description" value={currentGlobalNormDetails.description} onChange={handleGlobalDetailChange} placeholder="Auto-generated if blank" /></div>
          <div><Label htmlFor="weightInput">Weight:</Label><Input id="weightInput" type="number" name="weight" value={currentGlobalNormDetails.weight} onChange={handleGlobalDetailChange} step="0.1" min="0" /></div>

          {selectedNormType === NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES && (
            <>
              <div><Label htmlFor="thresholdInput">Threshold Seconds:</Label><Input id="thresholdInput" type="text" name="threshold_seconds" value={currentGlobalNormDetails.threshold_seconds} onChange={handleGlobalDetailChange} placeholder="e.g., 86400 for 1 day" /></div>
              <div>
                <Label htmlFor="thresholdCondition">Threshold Condition:</Label>
                <select id="thresholdCondition" value={thresholdCondition} onChange={(e) => setThresholdCondition(e.target.value as 'less than' | 'greater than')} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                  <option value="less than">Less than</option><option value="greater than">Greater than</option>
                </select>
              </div>
            </>
          )}

          {selectedNormType === NORM_TYPES.EVENT_TO_ENTITY_RELATIONSHIP && (
            <>
              <div>
                <Label htmlFor="e2o_operator">Relationship Constraint:</Label>
                <select id="e2o_operator" name="e2o_operator" value={currentGlobalNormDetails.e2o_operator} onChange={handleGlobalDetailChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm">
                  <option value="exists">Exists (≥ 1)</option>
                  <option value="not exists">Does not exist (is 0)</option>
                  <option value="==">Exactly equals (=)</option>
                  <option value="!=">Does not equal (≠)</option>
                  <option value=">">Greater than (&gt;)</option>
                  <option value="<">Less than (&lt;)</option>
                  <option value=">=">Greater than or equal to (≥)</option>
                  <option value="<=">Less than or equal to (≤)</option>
                </select>
              </div>
              {!['exists', 'not exists'].includes(currentGlobalNormDetails.e2o_operator) && (
                <div>
                  <Label htmlFor="e2o_count">Count:</Label>
                  <Input id="e2o_count" type="number" name="e2o_count" value={currentGlobalNormDetails.e2o_count} onChange={handleGlobalDetailChange} placeholder="e.g., 1"
                  />
                </div>
              )}
            </>
          )}

          {(selectedNormType === NORM_TYPES.EVENT_PROPERTY_VALUE || selectedNormType === NORM_TYPES.ENTITY_PROPERTY_VALUE) && (
            <div className="space-y-4 p-3 bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-600">
              <h4 className="font-semibold text-md">Property Condition</h4>
              <div><Label htmlFor="property_name">Property Name:</Label><Input id="property_name" type="text" name="property_name" value={currentGlobalNormDetails.property_name} onChange={handleGlobalDetailChange} placeholder="e.g., amount, status" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="property_data_type">Data Type:</Label>
                  <select id="property_data_type" name="property_data_type" value={currentGlobalNormDetails.property_data_type} onChange={handleGlobalDetailChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm">
                    <option value="string">String</option><option value="number">Number</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="property_operator">Operator:</Label>
                  <select id="property_operator" name="property_operator" value={currentGlobalNormDetails.property_operator} onChange={handleGlobalDetailChange} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm">
                    {currentGlobalNormDetails.property_data_type === 'string' ? (
                      <>
                        <option value="in">is one of</option>
                        <option value="not in">is not one of</option>
                      </>
                    ) : (
                      <>
                        <option value="==">=</option><option value="!=">!=</option>
                        <option value=">">&gt;</option><option value="<">&lt;</option>
                        <option value=">=">≥</option><option value="<=">≤</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="property_value">
                  Value(s)
                  {currentGlobalNormDetails.property_data_type === 'string' && <span className="text-gray-500 text-xs"> (comma-separated for 'is one of')</span>}
                </Label>
                <Input id="property_value" type="text" name="property_value" value={currentGlobalNormDetails.property_value} onChange={handleGlobalDetailChange} placeholder={currentGlobalNormDetails.property_data_type === 'string' ? "e.g., Shipped,Delivered" : "e.g., 100"} />
              </div>
            </div>
          )}

          {selectedNormType === NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS && (
            <div>
              <Label htmlFor="adfTypeSelect">Constraint:</Label>
              <select id="adfTypeSelect" value={currentGlobalNormDetails.forbidden ? "forbidden" : "allowed"}
                onChange={e => setCurrentGlobalNormDetails(prev => ({ ...prev, forbidden: e.target.value === "forbidden" }))}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
              >
                <option value="allowed">Should happen one after another</option>
                <option value="forbidden">Should NOT happen one after another</option>
              </select>
            </div>
          )}

          <div className="pt-2">
            <Label htmlFor="aggPropsInput" className="flex items-center">
              Aggregation Properties
              <Tooltip content="Optional. Comma-separated list of properties to group results by. E.g., 'vendor', 'country_code'">
                <InfoIcon className="cursor-help" />
              </Tooltip>
            </Label>
            <Input id="aggPropsInput" type="text" name="aggregation_properties" value={currentGlobalNormDetails.aggregation_properties} onChange={handleGlobalDetailChange} placeholder="e.g., supplier, region" />
          </div>
        </div>

        <hr className="my-6 border-gray-200 dark:border-gray-700" />
        <h3 className="text-lg font-semibold mb-3">Selected Element Properties</h3>
        {selectedElement && selectedElement.elementType === 'node' ? (
          <div className="properties-panel p-4 bg-gray-50 dark:bg-gray-750 rounded-md border border-gray-200 dark:border-gray-600">
            <p className="text-sm mb-1"><b>Node Role:</b> {selectedElement.data.isSource ? 'Source / Left' : (selectedElement.data.isTarget ? 'Target / Right' : 'Target')}</p>
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
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">Select an element in the graph to set its properties.</p>
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
          nodesDraggable={true} nodesConnectable={false} elementsSelectable={true}
          deleteKeyCode={null} panOnDrag={true} zoomOnScroll={true} zoomOnDoubleClick={true} zoomOnPinch={true}
        >
          <MiniMap nodeStrokeWidth={3} className="!bg-white dark:!bg-gray-700 !border-gray-300 dark:!border-gray-600" />
          <Controls className="!shadow-lg !rounded-md !border-gray-300 dark:!border-gray-600" />
          <Background gap={20} size={1} color="#cbd5e1" variant={BackgroundVariant.Dots} />
        </ReactFlow>
      </div>
      <div
        className="resizer cursor-col-resize w-2 bg-gray-300 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-700 transition-colors duration-150"
        style={{ zIndex: 20 }}
        onMouseDown={handleResizerMouseDown}
      />
      <div
        ref={outputPanelRef}
        className="output-panel"
        style={{ width: `${outputPanelWidth}px`, minWidth: `${MIN_PANEL_WIDTH}px`, maxWidth: `${MAX_PANEL_WIDTH}px` }}
      >
        <div className="w-full h-full p-5 bg-white dark:bg-gray-800 overflow-y-auto shadow-lg flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Created Norms ({createdNorms.length})</h2>
            <Button onClick={handleRunAnalysis} disabled={isAnalysisRunning || createdNorms.length === 0} variant="default">
              {isAnalysisRunning ? 'Running...' : 'Run Analysis'}
            </Button>
          </div>
          <div className="flex-grow overflow-y-auto">
            <NormsTable norms={createdNorms} />
            <h2 className="text-xl font-semibold mt-6 mb-3">Generated JSON Output</h2>
            <textarea
              readOnly
              value={JSON.stringify({ config: globalProcessConfig, norms: createdNorms, }, null, 2)}
              rows={10}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-xs font-mono"
            />
            <h2 className="text-xl font-semibold mt-6 mb-3">Analysis Results</h2>
            <pre className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-xs font-mono whitespace-pre-wrap overflow-x-auto h-64">
              {analysisResults || "Click 'Run Analysis' to see the results."}
            </pre>
          </div>
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
        const parsedConfig = JSON.parse(savedConfig);
        // Basic validation to ensure it's not an empty object
        if (Object.keys(parsedConfig).length > 0) {
          setGlobalProcessConfig(parsedConfig);
          setIsTechConfigMode(false);
        } else {
          localStorage.removeItem('globalProcessConfig');
        }
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

  const hasSavedConfig = useMemo(() => {
    try {
      const saved = localStorage.getItem('globalProcessConfig');
      return saved && Object.keys(JSON.parse(saved)).length > 0;
    } catch {
      return false;
    }
  }, [globalProcessConfig]);


  if (isTechConfigMode) {
    return <TechnicalConfigurator
      currentConfig={globalProcessConfig}
      onConfigSave={handleConfigSave}
      onCancel={hasSavedConfig ? () => setIsTechConfigMode(false) : undefined}
    />;
  }

  return (
    <ReactFlowProvider>
      <GraphNormCreatorInternal globalProcessConfig={globalProcessConfig} onBackToTechConfig={handleBackToTechConfig} />
    </ReactFlowProvider>
  );
};

export default App;