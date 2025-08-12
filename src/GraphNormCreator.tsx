import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
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
import { Button, Input, Label, Tooltip, InfoIcon } from './TechnicalConfiguration';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalConfig } from './GlobalConfig';
import { GlobalProcessConfig, initialGlobalProcessConfig } from './config';
import NormsTable from "./NormsTable";
import { CreatedNorm } from './App';
import { Link } from 'react-router-dom';
import PropertyFilter, { Filter } from './PropertyFilter';

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
  selected: boolean; label: string; type: string; name: string; icon?: string; isSource?: boolean; isTarget?: boolean;
}
type AppNode = Node<CustomNodeData>;
type AppEdge = Edge<{ label?: string }>;

// CORRECTED: This is now a proper discriminated union
type SelectedElement = (AppNode & { elementType: 'node' }) | (AppEdge & { elementType: 'edge' });

interface GlobalNormDetails {
  norm_id: string; description: string; weight: number; threshold_seconds: string;
  aggregation_properties: { name: string, attributeStorage: 'property' | 'node' }[];
  avg_time_edge_label: string;
  entity_follows_edge_label: string; activity_frequency_edge_label: string; forbidden?: boolean;
  df_type_prop_name: string; df_type_prop_value: string;
  e2o_operator: 'exists' | 'not exists' | '==' | '!=' | '>' | '<' | '>=' | '<=';
  e2o_count: string;
  filters: Filter[];
}

const initialGlobalNormDetails: GlobalNormDetails = {
  norm_id: '', description: '', weight: 1.0, threshold_seconds: '',
  aggregation_properties: [], avg_time_edge_label: 'DF', entity_follows_edge_label: 'DF_ENTITY',
  activity_frequency_edge_label: 'corr', df_type_prop_name: '', df_type_prop_value: '',
  e2o_operator: '>=', e2o_count: '1', forbidden: false,
  filters: [],
};

const SINGLE_NODE_ID = 'single-node';
const SOURCE_NODE_ID = 'source-node';
const TARGET_NODE_ID = 'target-node';
const PREDEFINED_EDGE_ID = 'edge-1';

// --- CustomNode ---
const CustomNode: React.FC<{ data: CustomNodeData, selected: boolean }> = ({ data, selected }) => {
  // Corrected Tailwind CSS classes for dark mode text
  const nodeClasses = `custom-node ${data.type.toLowerCase()}-node ${selected ? 'selected' : ''} p-0 rounded-lg shadow-md border-2`;
  const headerClasses = `custom-node-header px-3 py-2 border-b rounded-t-md flex items-center font-semibold text-xs uppercase tracking-wider`;
  const bodyClasses = "custom-node-body p-3";
  const nameClasses = "node-name text-sm font-medium break-words"; // CSS will handle color
  const displayName = data.name || `Unnamed ${data.type}`;

  return (
    <div className={nodeClasses} style={{ borderColor: data.selected ? '#3b82f6' : (data.type === (initialGlobalProcessConfig.eventNodeLabel || 'Activity') ? '#f59e0b' : '#0ea5e9') }}>
      <Handle type="target" position={Position.Left} className="!bg-gray-400 dark:!bg-gray-600 !w-3 !h-3 !border-2 !border-white dark:!border-gray-700" isConnectable={false} />
      <div className={headerClasses}>
        <span className="node-icon mr-2 text-base">{data.icon || (data.type === (initialGlobalProcessConfig.eventNodeLabel || 'Activity') ? '⚙️' : '🧱')}</span>
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

  const sourceBaseData = { name: '', icon: '', label: '', selected: false };
  const targetBaseData = { name: '', icon: '', label: '', selected: false };
  const singleBaseData = { name: '', icon: '', label: '', selected: false };


  switch (normType) {
    case NORM_TYPES.EVENT_PROPERTY_VALUE:
      predefinedNodes = [{
        id: SINGLE_NODE_ID, type: 'customNode',
        data: { ...singleBaseData, type: activityTypeLabel, icon: '⚙️', label: `Target ${activityTypeLabel}` },
        position: { x: 200, y: 150 }, draggable: true
      }];
      break;

    case NORM_TYPES.ENTITY_PROPERTY_VALUE:
      predefinedNodes = [{
        id: SINGLE_NODE_ID, type: 'customNode',
        data: { ...singleBaseData, type: entityTypeLabel, icon: '🧱', label: `Target ${entityTypeLabel}` },
        position: { x: 200, y: 150 }, draggable: true
      }];
      break;

    case NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES:
    case NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS:
      predefinedNodes = [
        {
          id: SOURCE_NODE_ID, type: 'customNode', data: {
            ...sourceBaseData, type: activityTypeLabel, icon: '⚙️', label: `${activityTypeLabel} A`, isSource: true
          }, position: { x: 50, y: 150 }, draggable: true
        },
        {
          id: TARGET_NODE_ID, type: 'customNode', data: {
            ...targetBaseData, type: activityTypeLabel, icon: '⚙️', label: `${activityTypeLabel} B`, isTarget: true
          }, position: { x: 350, y: 150 }, draggable: true
        },
      ];
      break;
    case NORM_TYPES.ENTITY_FOLLOWS_ENTITY:
      predefinedNodes = [
        {
          id: SOURCE_NODE_ID, type: 'customNode', data: {
            ...sourceBaseData, type: entityTypeLabel, icon: '🧱', label: `${entityTypeLabel} A`, isSource: true
          }, position: { x: 50, y: 150 }, draggable: true
        },
        {
          id: TARGET_NODE_ID, type: 'customNode', data: {
            ...targetBaseData, type: entityTypeLabel, icon: '🧱', label: `${entityTypeLabel} B`, isTarget: true
          }, position: { x: 350, y: 150 }, draggable: true
        },
      ];
      break;
    case NORM_TYPES.EVENT_TO_ENTITY_RELATIONSHIP:
      predefinedNodes = [
        {
          id: SOURCE_NODE_ID, type: 'customNode', data: {
            ...sourceBaseData, type: entityTypeLabel, icon: '🧱', label: `Context ${entityTypeLabel}`, isSource: true
          }, position: { x: 50, y: 150 }, draggable: true
        },
        {
          id: TARGET_NODE_ID, type: 'customNode', data: {
            ...targetBaseData, type: activityTypeLabel, icon: '⚙️', label: `Target ${activityTypeLabel}`, isTarget: true
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
  createdNorms: CreatedNorm[];
  setCreatedNorms: React.Dispatch<React.SetStateAction<CreatedNorm[]>>;
  onDeleteNorm: (normId: string) => void;
  onToggleNorm: (normId: string) => void;
  isEmbedded?: boolean;
}

const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 900;

const GraphNormCreatorInternal: React.FC<GraphNormCreatorInternalProps> = ({
  globalProcessConfig,
  createdNorms,
  setCreatedNorms,
  onDeleteNorm,
  onToggleNorm
}) => {
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState<CustomNodeData>([]);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState<AppEdge['data']>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<CustomNodeData, AppEdge['data']> | null>(null);
  const [selectedNormType, setSelectedNormType] = useState<NormTypeValue>(NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES);
  const [currentGlobalNormDetails, setCurrentGlobalNormDetails] = useState<GlobalNormDetails>(initialGlobalNormDetails);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [thresholdCondition, setThresholdCondition] = useState<'less than' | 'greater than'>('less than');
  const [analysisResults, setAnalysisResults] = useState<string>('');
  const [isAnalysisRunning, setIsAnalysisRunning] = useState<boolean>(false);
  const { autocompleteData } = useGlobalConfig();
  console.log(autocompleteData);


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

  // --- FIXED useEffect LOGIC ---

  // HOOK 1: Responds to a change in norm type to update the form's state.
  // It has no dependency on the state it sets, which prevents a loop.
  useEffect(() => {
    const isPropertyNorm = selectedNormType === NORM_TYPES.EVENT_PROPERTY_VALUE || selectedNormType === NORM_TYPES.ENTITY_PROPERTY_VALUE;

    setCurrentGlobalNormDetails(prev => ({
      ...initialGlobalNormDetails,
      // Preserve these user-entered fields across norm type changes
      norm_id: prev.norm_id,
      description: prev.description,
      weight: prev.weight,
      // Reset the filters based on the new norm type
      filters: isPropertyNorm ? [{ property_name: '', property_data_type: 'string', property_operator: 'in', property_value: '', attributeStorage: 'property' }] : [],
    }));

    // Also, reset the node/edge selection in the graph
    setSelectedElement(null);
  }, [selectedNormType, globalProcessConfig]);


  // HOOK 2: Responds to changes in the norm details (from Hook 1) or the graph instance.
  // Its only job is to update the visual graph's nodes and edges.
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = getPredefinedNodesAndEdges(selectedNormType, currentGlobalNormDetails, globalProcessConfig);

    // We update the nodes and edges based on the template
    setNodes(newNodes);
    setEdges(newEdges);

    if (reactFlowInstance && newNodes.length > 0) {
      setTimeout(() => reactFlowInstance.fitView({ padding: 0.2, duration: 300 }), 0);
    }
  }, [
    selectedNormType,
    globalProcessConfig,
    // Only include the details that affect the edge labels from getPredefinedNodesAndEdges
    currentGlobalNormDetails.avg_time_edge_label,
    currentGlobalNormDetails.entity_follows_edge_label,
    currentGlobalNormDetails.activity_frequency_edge_label,
    currentGlobalNormDetails.df_type_prop_name,
    // react-flow instance and setters
    reactFlowInstance,
    setNodes,
    setEdges
  ]);
  // HOOK 3: Specifically styles the edge for the 'Directly Follows' norm.
  // This is kept separate to keep logic clean.
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
    // This hook now only depends on the specific properties it uses, not the whole object.
  }, [selectedNormType, currentGlobalNormDetails.forbidden, currentGlobalNormDetails.avg_time_edge_label, globalProcessConfig, setEdges]);


  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: { nodes: AppNode[], edges: AppEdge[] }) => {
    if (selNodes.length > 0) {
      setSelectedElement({ ...selNodes[0], elementType: 'node' });
    } else if (selEdges.length > 0) {
      setSelectedElement({ ...selEdges[0], elementType: 'edge' });
    } else {
      setSelectedElement(null);
    }
  }, []);

  const handleGlobalDetailChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setCurrentGlobalNormDetails(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value),
    }));
  };

  const handleFilterChange = (index: number, field: keyof Filter, value: string | number) => {
    setCurrentGlobalNormDetails(prev => {
      const newFilters = [...prev.filters];
      newFilters[index] = { ...newFilters[index], [field]: value };
      return { ...prev, filters: newFilters };
    });
  };

  const addFilter = () => {
    setCurrentGlobalNormDetails(prev => ({
      ...prev,
      filters: [...prev.filters, { property_name: '', property_data_type: 'string', property_operator: 'in', property_value: '', attributeStorage: 'property' }]
    }));
  };

  const removeFilter = (index: number) => {
    setCurrentGlobalNormDetails(prev => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index)
    }));
  };

  const handleNodeDataChange = (nodeId: string, field: keyof CustomNodeData, value: string) => {
    let latestData: CustomNodeData | undefined;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const updatedData = { ...node.data, [field]: value };
          if (field === 'name') {
            const nodeTypeLabel = node.data.type === (globalProcessConfig.eventNodeLabel || 'Activity')
              ? (globalProcessConfig.eventNodeLabel || 'Activity')
              : (globalProcessConfig.entityNodeLabel || 'Entity');
            updatedData.label = value || `Unnamed ${nodeTypeLabel}`;
          }
          latestData = updatedData;
          return { ...node, data: updatedData };
        }
        return node;
      })
    );

    if (selectedElement && selectedElement.elementType === 'node' && selectedElement.id === nodeId && latestData) {
      const finalData = latestData;
      setSelectedElement((prev) => {
        if (prev?.elementType !== 'node') {
          return prev;
        }
        return {
          ...prev,
          data: finalData,
        };
      });
    }
  };

  const validateNormDetails = (): boolean => {
    const isTwoNodeNorm = ([
      NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES,
      NORM_TYPES.ENTITY_FOLLOWS_ENTITY,
      NORM_TYPES.EVENT_TO_ENTITY_RELATIONSHIP,
      NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS
    ] as NormTypeValue[]).includes(selectedNormType);

    const isPropertyNorm = ([
      NORM_TYPES.EVENT_PROPERTY_VALUE,
      NORM_TYPES.ENTITY_PROPERTY_VALUE
    ] as NormTypeValue[]).includes(selectedNormType);

    if (isTwoNodeNorm) {
      const sourceNode = nodes.find(n => n.id === SOURCE_NODE_ID);
      const targetNode = nodes.find(n => n.id === TARGET_NODE_ID);
      if (!sourceNode?.data?.name || !targetNode?.data?.name) {
        alert("Both source and target nodes in the graph must have a name. Select a node and set its name in the sidebar.");
        return false;
      }
      if (selectedNormType === NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES) {
        if (!currentGlobalNormDetails.threshold_seconds || isNaN(Number(currentGlobalNormDetails.threshold_seconds))) {
          alert("Threshold Seconds is required and must be a valid number.");
          return false;
        }
      }
    }

    if (isPropertyNorm) {
      const singleNode = nodes.find(n => n.id === SINGLE_NODE_ID);
      if (!singleNode?.data?.name) {
        alert("The target node in the graph must have a name. Select the node and set its name in the sidebar.");
        return false;
      }
      if (currentGlobalNormDetails.filters.length === 0) {
        alert("A property condition is required for this norm type.");
        return false;
      }
      const mainFilter = currentGlobalNormDetails.filters[0];
      if (!mainFilter.property_name || !mainFilter.property_value) {
        alert("Please specify the property name and the value to check against in the main property condition.");
        return false;
      }
    }

    for (const filter of currentGlobalNormDetails.filters) {
      if (!filter.property_name || !filter.property_value) {
        alert("All added filters must have a property name and a value.");
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
      // ... (description generation logic is correct and does not need changes)
      switch (selectedNormType) {
        case NORM_TYPES.AVERAGE_TIME_BETWEEN_ACTIVITIES: {
          return `Avg. time between ${activityLabel.toLowerCase()} "${sourceNode!.data.name}" and "${targetNode!.data.name}" should be ${thresholdCondition} ${currentGlobalNormDetails.threshold_seconds}s.`;
        }
        case NORM_TYPES.ENTITY_FOLLOWS_ENTITY: {
          return `${entityLabel} "${sourceNode!.data.name}" should follow ${entityLabel.toLowerCase()} "${targetNode!.data.name}".`;
        }
        case NORM_TYPES.EVENT_TO_ENTITY_RELATIONSHIP: {
          const relOp = currentGlobalNormDetails.e2o_operator;
          const relCount = currentGlobalNormDetails.e2o_count;
          let relDesc = '';
          if (relOp === 'exists') relDesc = 'at least one';
          else if (relOp === 'not exists') relDesc = 'zero';
          else relDesc = `${relOp} ${relCount}`;
          return `${activityLabel} "${targetNode!.data.name}" should be related to ${entityLabel.toLowerCase()} "${sourceNode!.data.name}" ${relDesc} time(s).`;
        }
        case NORM_TYPES.ACTIVITY_DIRECTLY_FOLLOWS: {
          return currentGlobalNormDetails.forbidden
            ? `It is forbidden for "${sourceNode!.data.name}" to be directly followed by "${targetNode!.data.name}".`
            : `"${sourceNode!.data.name}" should be directly followed by "${targetNode!.data.name}".`;
        }
        case NORM_TYPES.EVENT_PROPERTY_VALUE:
        case NORM_TYPES.ENTITY_PROPERTY_VALUE: {
          const mainFilter = currentGlobalNormDetails.filters[0];
          const label = selectedNormType === NORM_TYPES.EVENT_PROPERTY_VALUE ? activityLabel : entityLabel;
          // This coercion is safe for display purposes
          return `${label} "${singleNode!.data.name}" must have property "${mainFilter.property_name}" ${mainFilter.property_operator} "${String(mainFilter.property_value)}".`;
        }
        default: return "Custom norm description.";
      }
    })();

    const newNorm: Partial<CreatedNorm> = {
      enabled: true,
      norm_type: selectedNormType, norm_id: normId, description: description,
      weight: Number(currentGlobalNormDetails.weight) || 1.0,
      execution_filters: [],
    };
    const parseAggregationProps = (props: { name: string, attributeStorage: 'property' | 'node' }[]): { name: string, attributeStorage: 'property' | 'node' }[] => {
      return props.map(p => ({ name: p.name.trim(), attributeStorage: p.attributeStorage })).filter(p => p.name);
    };

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
      case NORM_TYPES.ENTITY_PROPERTY_VALUE: {
        const mainFilter = currentGlobalNormDetails.filters[0];

        // This helper function safely processes the filter value based on its type
        const getFilterValue = (filter: Filter) => {
          if (filter.property_data_type === 'number') {
            return parseFloat(String(filter.property_value));
          }
          if (filter.property_data_type === 'datetime') {
            if (filter.property_operator === 'between') {
              return [filter.property_value, filter.property_value_end];
            }
            return filter.property_value;
          }
          // Default to string processing
          if (filter.property_operator === 'in' || filter.property_operator === 'not in') {
            return String(filter.property_value).split(',').map(s => s.trim());
          }
          return filter.property_value;
        };

        // This block now uses the safe helper function, fixing the error.
        Object.assign(newNorm, {
          target_name: singleNode!.data.name,
          property_name: mainFilter.property_name,
          operator: mainFilter.property_operator,
          value: getFilterValue(mainFilter),
          aggregation_properties: parseAggregationProps(currentGlobalNormDetails.aggregation_properties),
        });

        newNorm.execution_filters = currentGlobalNormDetails.filters.slice(1);
        break;
      }
    }

    if (newNorm.execution_filters!.length === 0 && !([NORM_TYPES.EVENT_PROPERTY_VALUE, NORM_TYPES.ENTITY_PROPERTY_VALUE] as NormTypeValue[]).includes(selectedNormType)) {
      newNorm.execution_filters = currentGlobalNormDetails.filters;
    }

    setCreatedNorms(prev => [...prev, newNorm as CreatedNorm]);
    alert("Norm added!");
  };

  const handleRunAnalysis = async (runType: 'ad-hoc' | 'scheduled' = 'ad-hoc') => {
    if (createdNorms.length === 0) {
      alert("Please add at least one norm before running the analysis.");
      return;
    }
    setIsAnalysisRunning(true);
    setAnalysisResults('Running analysis...');

    const payload = {
      config: globalProcessConfig,
      norms: createdNorms,
      run_type: runType,
      schedule: runType === 'scheduled' ? 'weekly' : undefined,
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
    } catch (error: unknown) {
      console.error("Failed to run analysis:", error);
      if (error instanceof Error) {
        setAnalysisResults(`Error: ${error.message}`);
      } else {
        setAnalysisResults('An unknown error occurred.');
      }
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

  const isPropertyNorm = selectedNormType === NORM_TYPES.EVENT_PROPERTY_VALUE || selectedNormType === NORM_TYPES.ENTITY_PROPERTY_VALUE;

  return (
    <div className="graph-norm-creator-container flex flex-row h-screen w-screen bg-slate-900 text-slate-300">
      <div className="sidebar w-[380px] min-w-[350px] p-5 border-r border-slate-700 bg-slate-800/50 overflow-y-auto shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Norm Configuration</h2>

          <div className="flex space-x-2">
            <Link to="/" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded text-xs">
              Back to Dashboard
            </Link>
            <Link to="/configure" state={{ from: '/definitions' }} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded text-xs">
              Edit Tech Config
            </Link>
          </div>

        </div>
        <div className="mb-4">
          <Label htmlFor="normTypeSelect" className="text-slate-300">Norm Type:</Label>
          <select id="normTypeSelect" value={selectedNormType}
            onChange={(e) => setSelectedNormType(e.target.value as NormTypeValue)}
            className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
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
            {currentGlobalNormDetails.aggregation_properties.map((prop, index) => (
              <div key={index} className="flex items-center space-x-2 mt-2">
                <Input
                  type="text"
                  placeholder="Property Name"
                  value={prop.name}
                  onChange={(e) => {
                    const newAggProps = [...currentGlobalNormDetails.aggregation_properties];
                    newAggProps[index].name = e.target.value;
                    setCurrentGlobalNormDetails(prev => ({ ...prev, aggregation_properties: newAggProps }));
                  }}
                />
                <select
                  value={prop.attributeStorage}
                  onChange={(e) => {
                    const newAggProps = [...currentGlobalNormDetails.aggregation_properties];
                    newAggProps[index].attributeStorage = e.target.value as 'property' | 'node';
                    setCurrentGlobalNormDetails(prev => ({ ...prev, aggregation_properties: newAggProps }));
                  }}
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
                >
                  <option value="property">Property</option>
                  <option value="node">Node</option>
                </select>
                <Button onClick={() => {
                  const newAggProps = [...currentGlobalNormDetails.aggregation_properties];
                  newAggProps.splice(index, 1);
                  setCurrentGlobalNormDetails(prev => ({ ...prev, aggregation_properties: newAggProps }));
                }} variant="outline" className="text-white">
                  -
                </Button>
              </div>
            ))}
            <Button onClick={() => {
              setCurrentGlobalNormDetails(prev => ({
                ...prev,
                aggregation_properties: [...prev.aggregation_properties, { name: '', attributeStorage: 'property' }]
              }));
            }} variant="outline" className="w-full mt-2 text-white">
              + Add Aggregation Property
            </Button>
          </div>
        </div>

        {isPropertyNorm && (
          <>
            <hr className="my-6 border-gray-200 dark:border-gray-700" />
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-2">Main Property Condition</h3>
              {currentGlobalNormDetails.filters.slice(0, 1).map((filter, index) => (
                <PropertyFilter
                  key={index}
                  filter={filter}
                  index={index}
                  onChange={handleFilterChange}
                  onRemove={removeFilter}
                  isRemovable={index > 0}
                />
              ))}
            </div>
          </>
        )}
        <hr className="my-6 border-gray-200 dark:border-gray-700" />
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-2">Filters</h3>
          {currentGlobalNormDetails.filters.slice(1).map((filter, index) => (
            <PropertyFilter
              key={index}
              filter={filter}
              index={index}
              onChange={handleFilterChange}
              onRemove={removeFilter}
              isRemovable={true}
            />
          ))}
          <Button onClick={addFilter} variant="outline" className="w-full text-white">
            + Add Filter
          </Button>
        </div>

        <hr className="my-6 border-gray-200 dark:border-gray-700" />
        <h3 className="text-lg font-semibold mb-3">Selected Element Properties</h3>
        {selectedElement?.elementType === 'node' ? (
          <div className="properties-panel p-4 bg-gray-50 dark:bg-gray-750 rounded-md border border-gray-200 dark:border-gray-600">
            <p className="text-sm mb-1"><b>Node Role:</b> {'isSource' in selectedElement.data ? 'Source / Left' : ('isTarget' in selectedElement.data ? 'Target / Right' : 'Target')}</p>
            <p className="text-sm mb-3"><b>Type:</b> {selectedElement.data.type}</p>
            <Label htmlFor={`nodeNameInput-${selectedElement.id}`}><b>Name / Identifier (Value of '{selectedElement.data.type === (globalProcessConfig.eventNodeLabel || 'Activity') ? globalProcessConfig.activityProperty : globalProcessConfig.entityFilterProperty}') :</b></Label>
            <AutocompleteInput
              inputId={`nodeNameInput-${selectedElement.id}`}
              value={selectedElement.data.name || ''}
              onChange={(newValue) => handleNodeDataChange(selectedElement.id, 'name', newValue)}
              suggestions={selectedElement.data.type === (globalProcessConfig.eventNodeLabel || 'Activity') ? autocompleteData.activityTypes : autocompleteData.entityTypes}
              placeholder={`Enter Name for this ${selectedElement.data.type}`}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">Select an element in the graph to set its properties.</p>
        )}
        <hr className="my-6 border-gray-200 dark:border-gray-700" />
        <Button onClick={addNormToList} className="w-full">Add Current Configuration as Norm</Button>
      </div>

      <div className="canvas-container flex-grow relative h-full border-l border-r border-slate-700">
        <ReactFlow
          nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onInit={setReactFlowInstance} onSelectionChange={onSelectionChange}
          nodeTypes={memoizedNodeTypes} fitView
          className="bg-slate-900"
          nodesDraggable={true} nodesConnectable={false} elementsSelectable={true}
          deleteKeyCode={null} panOnDrag={true} zoomOnScroll={true} zoomOnDoubleClick={true} zoomOnPinch={true}
        >
          <MiniMap nodeStrokeWidth={3} className="!bg-slate-800 !border-slate-700" />
          <Controls className="!shadow-lg !rounded-md !border-slate-600" />
          <Background gap={20} size={1} color="#475569" variant={BackgroundVariant.Dots} />
        </ReactFlow>
      </div>
      <div
        className="resizer cursor-col-resize w-2 bg-slate-700 hover:bg-blue-500 transition-colors duration-150"
        style={{ zIndex: 20 }}
        onMouseDown={handleResizerMouseDown}
      />
      <div
        ref={outputPanelRef}
        className="output-panel"
        style={{ width: `${outputPanelWidth}px`, minWidth: `${MIN_PANEL_WIDTH}px`, maxWidth: `${MAX_PANEL_WIDTH}px` }}
      >
        <div className="w-full h-full p-5 bg-slate-800/50 overflow-y-auto shadow-lg flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Created Norms ({createdNorms.length})</h2>
            <div className="flex space-x-2">
              <Button onClick={() => handleRunAnalysis('ad-hoc')} disabled={isAnalysisRunning || createdNorms.length === 0} variant="default">
                {isAnalysisRunning ? 'Running...' : 'Run Analysis'}
              </Button>
              <Button onClick={() => handleRunAnalysis('scheduled')} disabled={isAnalysisRunning || createdNorms.length === 0} variant="outline">
                Run Weekly Scheduled Analysis
              </Button>
            </div>
          </div>
          <div className="flex-grow overflow-y-auto">
            <NormsTable norms={createdNorms} onDelete={onDeleteNorm} onToggle={onToggleNorm} />
            <h2 className="text-xl font-semibold mt-6 mb-3 text-white">Generated JSON Output</h2>
            <textarea
              readOnly
              value={JSON.stringify({ config: globalProcessConfig, norms: createdNorms.filter(n => n.enabled) }, null, 2)}
              rows={10}
              className="w-full p-2 border border-slate-600 rounded-md bg-slate-700 text-xs font-mono text-slate-300"
            />
            <h2 className="text-xl font-semibold mt-6 mb-3 text-white">Analysis Results</h2>
            <pre className="w-full p-3 border border-slate-600 rounded-md bg-slate-900 text-xs font-mono whitespace-pre-wrap overflow-x-auto h-64 text-slate-300">
              {analysisResults || "Click 'Run Analysis' to see the results."}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphNormCreatorInternal;