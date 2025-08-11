import datetime
import io
import os
import sys
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from abc import ABC, abstractmethod
from neo4j import GraphDatabase, Driver
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import traceback
import uuid

# --- Configuration & Parameters ---

CONFIG = {
    "event_node_label": "Event",
    "entity_node_label": "Entity",
    "df_rel_name": "DF",
    "corr_rel_name": "CORR",
    "df_entity_rel_name": "DF_ENTITY",
    "timestamp_property": "time",
    "entity_filter_property": "type",
    "activity_property": "type",
    "diagnostic_node_label": "Diagnostic",
    "compliance_rel_name": "COMPLIES_WITH",
    "diagnostic_relation_property": "related_id",
    "neo4j_uri": os.environ.get("NEO4J_URI", "bolt://localhost:7687"),
    "neo4j_user": os.environ.get("NEO4J_USER", "neo4j"),
    "neo4j_password": os.environ.get("NEO4J_PASSWORD", "12345678"),
    "analysis_run_node_label": "AnalysisRun",
    "generated_in_rel_name": "GENERATED_IN",
    "process_norm_node_label": "ProcessNorm",
    "defined_in_rel_name": "DEFINED_IN",
    "aggregation_result_node_label": "AggregationResult",
    "has_aggregate_rel_name": "HAS_AGGREGATE",
    "aggregation_property_node_label": "AggregationProperty",
    "defines_aggregation_by_rel_name": "DEFINES_AGGREGATION_BY",
    "aggregated_by_rel_name": "AGGREGATED_BY",
}

# --- Pydantic Models ---

class NormRequest(BaseModel):
    config: Dict[str, Any]
    norms: List[Dict[str, Any]]
    run_type: Optional[str] = "ad-hoc"
    schedule: Optional[str] = None

# --- FastAPI Setup ---
app = FastAPI()

# CORS (Cross-Origin Resource Sharing)
origins = [
    "http://localhost:5173",  # Default Vite dev server
    "http://localhost:3000",  # Default Create React App dev server
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Database Interaction ---

def get_neo4j_driver() -> Optional[Driver]:
    try:
        driver = GraphDatabase.driver(CONFIG["neo4j_uri"], auth=(CONFIG["neo4j_user"], CONFIG["neo4j_password"]))
        with driver.session() as session:
            session.run("RETURN 1")
        print("Successfully connected to Neo4j.")
        return driver
    except Exception as e:
        print(f"Error connecting to Neo4j: {e}")
        return None


def execute_query(driver: Optional[Driver], query: str, parameters: Optional[Dict] = None) -> Optional[List[Dict]]:
    if not driver or not query:
        print("Query execution skipped: No driver or query provided.")
        return None

    print("\n--- Executing Query ---")
    # print(query) # Uncomment for debug
    # print(f"Parameters: {parameters}") # Uncomment for debug
    results_list = []
    try:
        with driver.session(database="neo4j") as session:
            result = session.run(query, parameters if parameters else {})
            for record in result:
                results_list.append(record.data())
            summary = result.consume()
            counters = summary.counters
            print(f"Query completed in {summary.result_available_after} ms.")
            if counters.nodes_created > 0 or counters.relationships_created > 0 or counters.properties_set > 0:
                print(
                    f"  Write summary: Nodes created: {counters.nodes_created}, Rels created: {counters.relationships_created}, Props set: {counters.properties_set}")
            return results_list
    except Exception as e:
        print(f"Error executing query: {e}\nFailed Query:\n{query}")
        if parameters:
            print(f"Failed Query Parameters: {parameters}")
        return None


def create_df_entity_relationship(driver: Optional[Driver], config: Dict[str, Any]):
    """
    Executes the Cypher query to create the DF_ENTITY relationship.
    Uses parameters from the config dictionary.
    """
    if not driver:
         print("\n=== DF_ENTITY Creation Skipped - No Driver ===")
         return

    print("\n=== Creating DF_ENTITY Relationships ===")
    entity_label = config['entity_node_label']
    event_label = config['event_node_label']
    corr_rel = config['corr_rel_name']
    df_rel = config['df_rel_name']
    df_entity_rel = config['df_entity_rel_name'] # Use the name from config

    # Cypher query to create the DF_ENTITY relationship based on shortest event path
    cypher_query = f"""
    MATCH (e1:{entity_label})
    MATCH p = SHORTEST 1 (e1)<-[:{corr_rel}]-(:{event_label})-[:{df_rel}*1..3]->(:{event_label})-[:{corr_rel}]->(e2:{entity_label})
    WHERE e1 <> e2
    WITH e1, e2
    ORDER BY e2.time ASC
    WITH e1, head(collect(e2)) as first_e2
    MERGE (e1)-[r:{df_entity_rel}]->(first_e2)
    RETURN count(r) as relationships_merged // Return count for confirmation
    """

    print(f"Executing DF_ENTITY creation query...")
    execute_query(driver, cypher_query)
    print("=== DF_ENTITY Relationship Creation Complete ===")


# --- Reporting ---

def format_aggregation_results(norm_id: str, description: str, results: Optional[List[Dict]]) -> str:
    report_lines = [
        f"\n--- Aggregation Report for Norm: {norm_id} ---",
        f"Description: {description}",
        f"Timestamp: {datetime.datetime.now().isoformat()}",
        "-" * 40
    ]
    if results is None:
        report_lines.append("Execution failed or skipped.")
    elif not results:
        report_lines.append("No aggregation results found.")
    else:
        try:
            df = pd.DataFrame(results)
            # Try to find compliant/total columns
            compliant_col = next((col for col in df.columns if "compliant" in col), None)
            total_col = next((col for col in df.columns if "total" in col), None)
            if compliant_col and total_col:
                df["% compliant"] = (df[compliant_col] / df[total_col] * 100).round(2)
                df["Compliance"] = df["% compliant"].apply(lambda x: "✅" if x == 100 else ("⚠️" if x > 0 else "❌"))
                # Sort by compliance descending
                df = df.sort_values(by="% compliant", ascending=False)
            report_lines.append(df.to_string(index=False))
        except Exception as e:
            report_lines.append(f"Error formatting results with pandas: {e}")
            report_lines.append(f"Raw results: {results}")

    report_lines.append("\n" + "-" * 40)
    # Suggest improvement: If compliance is low, suggest checking data or norm definition
    if results and compliant_col and total_col:
        overall_compliance = df[compliant_col].sum() / df[total_col].sum() * 100
        if overall_compliance < 80:
            report_lines.append(
                f"⚠️  Overall compliance is below 80% ({overall_compliance:.2f}%). Consider reviewing the process or norm definition.")
    return "\n".join(report_lines)


# --- Process Norm Classes ---

class ProcessNorm(ABC):
    def __init__(self, norm_id: str, description: str, weight: float = 1.0):
        self.norm_id = norm_id
        self.description = description
        self.weight = weight

    @abstractmethod
    def generate_diagnostic_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        pass

    @abstractmethod
    def generate_aggregation_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        pass
    
    def _build_single_filter_expression(self, node_alias: str, filter_data: Dict, param_prefix: str) -> Tuple[str, Dict]:
        """Builds a single Cypher condition from a filter dictionary."""
        prop_name = filter_data['property_name']
        operator = filter_data['property_operator']
        value = filter_data['property_value']
        data_type = filter_data.get('property_data_type', 'string')

        prop_accessor = f"{node_alias}.`{prop_name}`"
        params = {}

        if data_type == 'datetime':
            op_map = {"before": "<", "after": ">"}
            if operator == 'between':
                val_end = filter_data['property_value_end']
                start_param, end_param = f"{param_prefix}_start", f"{param_prefix}_end"
                params[start_param], params[end_param] = value, val_end
                return f"({prop_accessor} >= datetime(${start_param}) AND {prop_accessor} <= datetime(${end_param}))", params
            elif operator in op_map:
                param_name = param_prefix
                params[param_name] = value
                return f"({prop_accessor} {op_map[operator]} datetime(${param_name}))", params
        else:  # string or number
            op_map = {"==": "=", "!=": "<>", ">": ">", "<": "<", ">=": ">=", "<=": "<=", "in": "IN", "not in": "NOT IN"}
            if operator in op_map:
                param_name = param_prefix
                params[param_name] = value
                return f"({prop_accessor} IS NOT NULL AND {prop_accessor} {op_map[operator]} ${param_name})", params
        
        return "", {} # Return empty if operator is not supported for the type

    def _build_filter_clause(self, node_alias: str, filters: List[Dict]) -> Tuple[str, Dict]:
        """Builds a full WHERE clause from a list of filters, supporting both property and node attribute storage."""
        if not filters:
            return "", {}

        config = getattr(self, "config", CONFIG)  # fallback to global CONFIG if not set
        all_clauses = []
        all_params = {}
        match_clauses = []

        for i, f in enumerate(filters):
            attribute_storage = f.get("attributeStorage", "property")
            prop_name = f['property_name']
            operator = f['property_operator']
            value = f['property_value']
            param_prefix = f"exec_filter_{i}"

            if attribute_storage == 'node':
                # Attribute stored as related node
                attr_rel = config.get("attribute_rel_name", "HAS_ATTRIBUTE")
                attr_label = config.get("attributeNodeLabel", "Attribute")
                attr_name_prop = config.get("attribute_name_property", "name")
                attr_value_prop = config.get("attribute_value_property", "value")
                attr_alias = f"attr_{i}"

                # Build MATCH for attribute node (strict filtering)
                match_clauses.append(f"MATCH ({node_alias})-[:`{attr_rel}`]->({attr_alias}:`{attr_label}` {{ `{attr_name_prop}`: '{prop_name}' }})")
                op_map = {"==": "=", "!=": "<>", ">": ">", "<": "<", ">=": ">=", "<=": "<=", "in": "IN", "not in": "NOT IN"}
                cypher_op = op_map.get(operator)
                if cypher_op:
                    param_name = param_prefix
                    all_params[param_name] = value
                    filter_expr = f"({attr_alias}.`{attr_value_prop}` IS NOT NULL AND {attr_alias}.`{attr_value_prop}` {cypher_op} ${param_name})"
                    all_clauses.append(filter_expr)
            else:
                # Attribute stored as property
                clause, params = self._build_single_filter_expression(node_alias, f, param_prefix)
                if clause:
                    all_clauses.append(clause)
                    all_params.update(params)

        if not all_clauses:
            return "", {}

        match_str = "\n".join(match_clauses)
        where_str = " AND ".join(all_clauses)
        
        if match_str and where_str:
            return f"{match_str}\nWHERE {where_str}", all_params
        elif match_str:
            return match_str, all_params
        else:
            return f"WHERE {where_str}", all_params

    def _generate_aggregation_query_template(
            self,
            config: Dict[str, Any],
            match_clause: str,
            grouping_properties: List[Dict[str, Any]],
            grouping_entity_alias: str,
            aggregation_expressions: List[str]
    ) -> str:

        if not grouping_properties:
            return f"""
            {match_clause}
            RETURN 'Overall' as grouping_key,
                   {','.join(aggregation_expressions)}
            """

        match_clauses = []
        grouping_key_parts = []

        for i, prop_info in enumerate(grouping_properties):
            prop_name = prop_info['name']
            attribute_storage = prop_info.get('attributeStorage', 'property')
            
            if attribute_storage == 'node':
                attr_rel = config.get("attribute_rel_name", "HAS_ATTRIBUTE")
                attr_label = config.get("attributeNodeLabel", "Attribute")
                attr_name_prop = config.get("attribute_name_property", "name")
                attr_value_prop = config.get("attribute_value_property", "value")
                alias = f"attr_{i}"
                match_clauses.append(
                    f"OPTIONAL MATCH ({grouping_entity_alias})-[:`{attr_rel}`]->({alias}:`{attr_label}` {{ `{attr_name_prop}`: '{prop_name}' }})")
                grouping_key_parts.append(f"coalesce(toString({alias}.`{attr_value_prop}`), 'N/A')")
            else: # 'property'
                grouping_key_parts.append(f"coalesce(toString({grouping_entity_alias}.`{prop_name}`), 'N/A')")

        additional_matches = "\n        ".join(match_clauses)
        grouping_key_str = f"[{', '.join(grouping_key_parts)}]"

        query = f"""
        {match_clause}
        {additional_matches}
        RETURN {grouping_key_str} as grouping_key,
               {','.join(aggregation_expressions)}
        """
        return query

    def run_analysis(self, driver: Optional[Driver], config: Dict[str, Any], params: Dict[str, Any]) -> Optional[str]:
        if not driver:
            no_driver_msg = f"Analysis skipped for Norm: {self.norm_id} - No database driver."
            print(no_driver_msg)
            return no_driver_msg

        print(f"\n=== Running Analysis for Norm: {self.norm_id} ===")
        print(f"Description: {self.description}")
        run_id = params.get("run_id")

        diag_query_tuple = self.generate_diagnostic_query(config, params)
        if diag_query_tuple:
            diag_query, diag_params = diag_query_tuple
            execute_query(driver, diag_query, diag_params)
        else:
            print("Diagnostic query generation skipped or failed.")

        agg_query_tuple = self.generate_aggregation_query(config, params)
        report = None
        if agg_query_tuple:
            agg_query, agg_params = agg_query_tuple
            agg_results = execute_query(driver, agg_query, agg_params)
            if agg_results and run_id:
                persist_aggregation_results(driver, config, self.norm_id, run_id, agg_results, params.get("aggregation_properties", []))
            report = format_aggregation_results(self.norm_id, self.description, agg_results)
        else:
            print("Aggregation query generation skipped or failed.")

        print(f"=== Analysis Complete for Norm: {self.norm_id} ===\n")
        return report


# --- Norm Implementations ---

class AverageTimeBetweenActivitiesNorm(ProcessNorm):
    def generate_diagnostic_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        # Behavior parameters
        activity_a, activity_b = params.get("activity_a"), params.get("activity_b")
        threshold_seconds, threshold_condition = params.get("threshold_seconds"), params.get("threshold_condition", "less than")
        if not all([activity_a, activity_b, threshold_seconds is not None]): return None
        operator = "<" if threshold_condition == "less than" else ">"

        # Logic for execution_filters
        execution_filters = params.get("execution_filters", [])
        filter_conditions, filter_params = self._build_filter_clause("ev_a", execution_filters)
        additional_where = f"AND {filter_conditions}" if filter_conditions else ""

        # Query with added filter conditions
        query = f"""
        MATCH (ev_a:{config['event_node_label']} {{ `{config['activity_property']}`: $activity_a }})
        MATCH (ev_b:{config['event_node_label']} {{ `{config['activity_property']}`: $activity_b }})
        WHERE ev_a.`{config['timestamp_property']}` < ev_b.`{config['timestamp_property']}` {additional_where}
        WITH ev_a, ev_b, duration.inSeconds(ev_a.`{config['timestamp_property']}`, ev_b.`{config['timestamp_property']}`) as dur
        WHERE dur IS NOT NULL
        WITH ev_a, ev_b, dur.seconds as duration_seconds, (dur.seconds {operator} $threshold_seconds) as complies
        MERGE (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id, related_id: elementId(ev_a) + '_' + elementId(ev_b) }})
        SET diag.complies = complies, diag.duration_seconds = duration_seconds
        MERGE (ev_a)-[:{config['compliance_rel_name']}]->(diag)
        MERGE (ev_b)-[:{config['compliance_rel_name']}]->(diag)

        WITH diag
        MATCH (run:{config['analysis_run_node_label']} {{ run_id: $run_id }})
        MERGE (diag)-[:`{config['generated_in_rel_name']}`]->(run)
        """
        query_params = {**params, **filter_params}
        return query, query_params

    def generate_aggregation_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        match_clause = f"MATCH (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id }})<-[:{config['compliance_rel_name']}]-(start_node) WHERE diag.duration_seconds IS NOT NULL"
        grouping_properties = params.get("aggregation_properties", [])
        expressions = [
            "avg(diag.duration_seconds) as avg_duration",
            "min(diag.duration_seconds) as min_duration",
            "max(diag.duration_seconds) as max_duration",
            "count(diag) as total_instances",
            "SUM(CASE WHEN diag.complies THEN 1 ELSE 0 END) as compliant_instances"
        ]
        query = self._generate_aggregation_query_template(config, match_clause, grouping_properties, "start_node",
                                                          expressions)
        return query, {"norm_id": self.norm_id}


class EntityFollowsEntityNorm(ProcessNorm):
    def generate_diagnostic_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        entity_type_a, entity_type_b = params.get("entity_type_a"), params.get("entity_type_b")
        if not entity_type_a or not entity_type_b: return None

        execution_filters = params.get("execution_filters", [])
        filter_conditions, filter_params = self._build_filter_clause("ea", execution_filters)
        where_clause = f"WHERE {filter_conditions}" if filter_conditions else ""

        query = f"""
        MATCH (ea:{config['entity_node_label']} {{ `{config['entity_filter_property']}`: $entity_type_a }})
        OPTIONAL MATCH (ea)-[:`{config['df_entity_rel_name']}`]->(eb:{config['entity_node_label']} {{ `{config['entity_filter_property']}`: $entity_type_b }})
        WITH ea, (eb IS NOT NULL) as complies
        MERGE (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id, related_id: elementId(ea) }})
        SET diag.complies = complies
        WITH diag
        MATCH (run:{config['analysis_run_node_label']} {{ run_id: $run_id }})
        MERGE (diag)-[:`{config['generated_in_rel_name']}`]->(run)
        """
        query_params = {**params, **filter_params}
        return query, query_params

    def generate_aggregation_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        match_clause = f"MATCH (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id }})<-[:{config['compliance_rel_name']}]-(entity)"
        grouping_properties = params.get("aggregation_properties", [])
        expressions = [
            "count(diag) as total_entities",
            "SUM(CASE WHEN diag.complies THEN 1 ELSE 0 END) as compliant_entities"
        ]
        query = self._generate_aggregation_query_template(config, match_clause, grouping_properties, "entity",
                                                          expressions)
        return query, {"norm_id": self.norm_id}


class EventToEntityRelationshipNorm(ProcessNorm):
    def generate_diagnostic_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        context_entity_type, target_activity = params.get("context_entity_type"), params.get("target_activity")
        operator, count = params.get("operator"), params.get("count")
        if not all([context_entity_type, target_activity, operator]): return None

        execution_filters = params.get("execution_filters", [])
        filter_conditions, filter_params = self._build_filter_clause("ctx", execution_filters)
        where_clause = f"WHERE {filter_conditions}" if filter_conditions else ""

        op_map = {"exists": ">", "not exists": "=", "==": "=", "!=": "<>", ">": ">", "<": "<", ">=": ">=", "<=": "<="}
        cypher_op = op_map.get(operator)
        if not cypher_op: return None
        if operator in ['exists', 'not exists']: count = 0
        elif count is None: return None
        
        query = f"""
        MATCH (ctx:{config['entity_node_label']} {{ `{config['entity_filter_property']}`: $context_entity_type }})
        {where_clause}
        OPTIONAL MATCH (ctx)<-[:{config['corr_rel_name']}]-(ev:{config['event_node_label']} {{ `{config['activity_property']}`: $target_activity }})
        WITH ctx, count(ev) as actual_count
        WITH ctx, actual_count, (actual_count {cypher_op} $count) as complies
        MERGE (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id, related_id: elementId(ctx) }})
        SET diag.complies = complies, diag.actual_count = actual_count
        MERGE (ctx)-[:{config['compliance_rel_name']}]->(diag)

        WITH diag
        MATCH (run:{config['analysis_run_node_label']} {{ run_id: $run_id }})
        MERGE (diag)-[:`{config['generated_in_rel_name']}`]->(run)
        """
        query_params = {**params, **filter_params}
        return query, query_params

    def generate_aggregation_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        match_clause = f"MATCH (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id }})<-[:{config['compliance_rel_name']}]-(ctx) WHERE diag.actual_count IS NOT NULL"
        grouping_properties = params.get("aggregation_properties", [])
        expressions = [
            "avg(diag.actual_count) as avg_count",
            "min(diag.actual_count) as min_count",
            "max(diag.actual_count) as max_count",
            "count(diag) as total_entities",
            "SUM(CASE WHEN diag.complies THEN 1 ELSE 0 END) as compliant_entities"
        ]
        query = self._generate_aggregation_query_template(config, match_clause, grouping_properties, "ctx", expressions)
        return query, {"norm_id": self.norm_id}


class ActivityDirectlyFollowsNorm(ProcessNorm):
    def generate_diagnostic_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        activity_a, activity_b, forbidden = params.get("activity_a"), params.get("activity_b"), params.get("forbidden", False)
        if not activity_a or not activity_b: return None

        execution_filters = params.get("execution_filters", [])
        filter_conditions, filter_params = self._build_filter_clause("ev_a", execution_filters)
        where_clause = f"WHERE {filter_conditions}" if filter_conditions else ""
        
        query = f"""
        MATCH (ev_a:{config['event_node_label']} {{ `{config['activity_property']}`: $activity_a }})
        {where_clause}
        OPTIONAL MATCH (ev_a)-[:{config['df_rel_name']}]->(ev_b:{config['event_node_label']} {{ `{config['activity_property']}`: $activity_b }})
        WITH ev_a, (ev_b IS NOT NULL) as directly_follows
        WITH ev_a, directly_follows, (directly_follows = ${not forbidden}) as complies
        MERGE (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id, related_id: elementId(ev_a) }})
        SET diag.complies = complies
        MERGE (ev_a)-[:{config['compliance_rel_name']}]->(diag)

        WITH diag
        MATCH (run:{config['analysis_run_node_label']} {{ run_id: $run_id }})
        MERGE (diag)-[:`{config['generated_in_rel_name']}`]->(run)
        """
        query_params = {**params, **filter_params}
        return query, query_params

    def generate_aggregation_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        match_clause = f"MATCH (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id }})<-[:{config['compliance_rel_name']}]-(event)"
        grouping_properties = params.get("aggregation_properties", [])
        expressions = [
            "count(diag) as total_instances",
            "SUM(CASE WHEN diag.complies THEN 1 ELSE 0 END) as compliant_instances"
        ]
        query = self._generate_aggregation_query_template(config, match_clause, grouping_properties, "event",
                                                          expressions)
        return query, {"norm_id": self.norm_id}


class PropertyValueNorm(ProcessNorm):
    @abstractmethod
    def get_node_match(self, config: Dict[str, Any], params: Dict[str, Any]) -> str:
        pass

    def generate_diagnostic_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        target_name, property_name, operator, value = params.get("target_name"), params.get("property_name"), params.get("operator"), params.get("value")
        if not all([target_name, property_name, operator, value is not None]):
            print("Error [PropertyValue]: Missing required parameters.")
            return None

        op_map = {"==": "=", "!=": "<>", ">": ">", "<": "<", ">=": ">=", "<=": "<=", "in": "IN", "not in": "NOT IN"}
        cypher_op = op_map.get(operator)
        if not cypher_op:
            print(f"Error [PropertyValue]: Invalid operator '{operator}'.")
            return None

        # --- Step 2: ADDED logic for execution_filters ---
        execution_filters = params.get("execution_filters", [])
        filter_conditions, filter_params = self._build_filter_clause("n", execution_filters)
        where_clause = f"{filter_conditions}" if filter_conditions else ""

        # --- Step 3: Combine original behavior with added filters ---
        attribute_storage = params.get("attributeStorage", "property")
        match_clause = self.get_node_match(config, params)
        
        # This is the original logic you provided, now with the `where_clause` added
        if attribute_storage == 'node':
            attr_rel = config.get("attribute_rel_name", "HAS_ATTRIBUTE")
            attr_label = config.get("attributeNodeLabel", "Attribute")
            attr_name_prop = config.get("attribute_name_property", "name")
            attr_value_prop = config.get("attribute_value_property", "value")
            query = f"""
            {match_clause}
            {where_clause}
            WITH n
            OPTIONAL MATCH (n)-[:`{attr_rel}`]->(attr:`{attr_label}` {{ `{attr_name_prop}`: $property_name }})
            WITH n, (attr IS NOT NULL AND attr.`{attr_value_prop}` IS NOT NULL AND attr.`{attr_value_prop}` {cypher_op} $value) as complies
            MERGE (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id, related_id: elementId(n) }})
            SET diag.complies = complies
            MERGE (n)-[:{config['compliance_rel_name']}]->(diag)
            """
        else:  # 'property'
            query = f"""
            {match_clause}
            {where_clause}
            WITH n, (n.`{property_name}` IS NOT NULL AND n.`{property_name}` {cypher_op} $value) as complies
            MERGE (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id, related_id: elementId(n) }})
            SET diag.complies = complies
            MERGE (n)-[:{config['compliance_rel_name']}]->(diag)
            """
        query += f"""
        WITH diag
        MATCH (run:{config['analysis_run_node_label']} {{ run_id: $run_id }})
        MERGE (diag)-[:`{config['generated_in_rel_name']}`]->(run)
        """
        print(query)

        print(value)

        # Combine parameters from the main check and the added filters
        query_params = {
            "value": value,
            "norm_id": self.norm_id,
            "target_name": target_name,
            "property_name": property_name,
            "run_id": params.get("run_id"),
            **filter_params
        }
        return query, query_params

    def generate_aggregation_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        match_clause = f"MATCH (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id }})<-[:{config['compliance_rel_name']}]-(n)"
        grouping_properties = params.get("aggregation_properties", [])
        expressions = [
            "count(diag) as total_nodes",
            "SUM(CASE WHEN diag.complies THEN 1 ELSE 0 END) as compliant_nodes"
        ]
        query = self._generate_aggregation_query_template(config, match_clause, grouping_properties, "n", expressions)
        return query, {"norm_id": self.norm_id}


class EventPropertyValueNorm(PropertyValueNorm):
    def get_node_match(self, config: Dict[str, Any], params: Dict[str, Any]) -> str:
        return f"MATCH (n:{config['event_node_label']} {{ `{config['activity_property']}`: $target_name }})"


class EntityPropertyValueNorm(PropertyValueNorm):
    def get_node_match(self, config: Dict[str, Any], params: Dict[str, Any]) -> str:
        return f"MATCH (n:{config['entity_node_label']} {{ `{config['entity_filter_property']}`: $target_name }})"


# --- JSON Parsing and Execution ---

NORM_CLASS_MAP = {
    "AverageTimeBetweenActivitiesNorm": AverageTimeBetweenActivitiesNorm,
    "EntityFollowsEntityNorm": EntityFollowsEntityNorm,
    "EventToEntityRelationshipNorm": EventToEntityRelationshipNorm,
    "ActivityDirectlyFollowsNorm": ActivityDirectlyFollowsNorm,
    "EventPropertyValueNorm": EventPropertyValueNorm,
    "EntityPropertyValueNorm": EntityPropertyValueNorm,
}


def parse_and_run_norms(driver: Optional[Driver], config: Dict[str, Any], data: Dict[str, Any], run_id: str) -> List[str]:
    reports = []
    json_config = data.get("config", {})
    config.update(json_config)

    for norm_data in data.get("norms", []):
        norm_type = norm_data.get("norm_type")
        norm_class = NORM_CLASS_MAP.get(norm_type)

        if not norm_class:
            print(f"Unknown norm type: {norm_type}. Skipping.")
            continue

        try:
            norm = norm_class(
                norm_id=norm_data["norm_id"],
                description=norm_data["description"],
                weight=norm_data.get("weight", 1.0)
            )
            norm_params = {**norm_data, "run_id": run_id}
            if norm_type in ["EventPropertyValueNorm", "EntityPropertyValueNorm"]:
                if "filters" in norm_data and norm_data["filters"]:
                    norm_params["attributeStorage"] = norm_data["filters"][0].get("attributeStorage", "property")
            report = norm.run_analysis(driver, config, norm_params)
            if report:
                reports.append(report)
        except KeyError as e:
            print(f"Skipping invalid norm definition (missing {e}): {norm_data}")
        except Exception as e:
            print(f"An error occurred while running norm {norm_data.get('norm_id')}: {e}")
    return reports

class ConfigForTypes(BaseModel):
    config: Dict[str, Any]

class DisaggregatedViolation(BaseModel):
    value: str
    percentage: float

class TopRule(BaseModel):
    rule_id: str
    description: str
    violations: int
    disaggregated_violations: Optional[List[DisaggregatedViolation]] = None

class TrendPoint(BaseModel):
    period: str
    violations: int

class ActiveRule(BaseModel):
    rule_id: str
    description: str
    status: str
    monitored_objects: List[str]

class DashboardData(BaseModel):
    overall_compliance: float
    total_violations: int
    top_violated_rules: List[TopRule]
    trend_data: List[TrendPoint]
    active_rules: List[ActiveRule]

def persist_aggregation_results(driver: Driver, config: Dict, norm_id: str, run_id: str, results: List[Dict], aggregation_properties: List[Dict]):
    """
    Persists aggregation results as nodes and links them to the AnalysisRun
    and the AggregationProperty nodes that defined them.
    """
    if not aggregation_properties:
        return # Nothing to link, so we can stop.

    agg_label = config['aggregation_result_node_label']
    run_label = config['analysis_run_node_label']
    has_agg_rel = config['has_aggregate_rel_name']
    norm_label = config['process_norm_node_label']
    agg_prop_label = config['aggregation_property_node_label']
    defines_agg_rel = config['defines_aggregation_by_rel_name']
    agg_by_rel = config['aggregated_by_rel_name']

    query = f"""
    UNWIND $results as result_row
    MATCH (run:{run_label} {{run_id: $run_id}})
    MATCH (norm:{norm_label} {{norm_id: $norm_id}})

    // Create the AggregationResult node
    CREATE (agg_res:{agg_label})
    SET agg_res = result_row, agg_res.norm_id = $norm_id
    MERGE (run)-[:`{has_agg_rel}`]->(agg_res)

    // Link to the defining AggregationProperty node(s)
    WITH agg_res, norm
    UNWIND $agg_props as agg_prop_def
    MATCH (norm)-[:`{defines_agg_rel}`]->(ap:{agg_prop_label} {{name: agg_prop_def.name}})
    MERGE (agg_res)-[:`{agg_by_rel}`]->(ap)
    """
    params = {
        "results": results,
        "run_id": run_id,
        "norm_id": norm_id,
        "agg_props": aggregation_properties
    }
    execute_query(driver, query, params)
    print(f"Persisted {len(results)} aggregation results for norm {norm_id} in run {run_id}.")


def run_analysis_from_request(request_data: NormRequest) -> str:
    driver = get_neo4j_driver()
    if not driver: return "Error: Could not connect to Neo4j database."

    run_id = str(uuid.uuid4())
    run_label = CONFIG['analysis_run_node_label']
    
    create_run_query = f"""
    CREATE (run:{run_label} {{
        run_id: $run_id, 
        run_type: $run_type,
        schedule: $schedule,
        start_time: datetime(), 
        status: 'running'
    }})
    """
    execute_query(driver, create_run_query, {
        "run_id": run_id, 
        "run_type": request_data.run_type,
        "schedule": request_data.schedule
    })

    if request_data.run_type == "scheduled":
        persist_norms(driver, request_data.norms, run_id)

    old_stdout = sys.stdout
    sys.stdout = captured_output = io.StringIO()
    reports = []
    try:
        base_config = CONFIG.copy()
        reports = parse_and_run_norms(driver, base_config, request_data.model_dump(), run_id)
        status = 'completed'
    except Exception:
        status = 'failed'
        traceback.print_exc(file=sys.stdout)
    finally:
        update_status_query = f"MATCH (run:{run_label} {{run_id: $run_id}}) SET run.status = $status"
        execute_query(driver, update_status_query, {"run_id": run_id, "status": status})
        sys.stdout = old_stdout
        log_output = captured_output.getvalue()
        driver.close()
        print("Neo4j connection closed.")

    return f"Analysis run {run_id} ({status}) completed.\n\n" + log_output + "\n".join(reports)


def persist_norms(driver: Driver, norms: List[Dict[str, Any]], run_id: str):
    """
    Creates ProcessNorm nodes, their associated AggregationProperty nodes,
    and links them to the AnalysisRun.
    """
    norm_label = CONFIG['process_norm_node_label']
    run_label = CONFIG['analysis_run_node_label']
    defined_in_rel = CONFIG['defined_in_rel_name']
    agg_prop_label = CONFIG['aggregation_property_node_label']
    agg_rel_name = CONFIG['defines_aggregation_by_rel_name']

    for norm_data in norms:
        properties = norm_data.copy()
        norm_id = properties.get("norm_id")
        if not norm_id:
            continue

        # Extract complex properties and remove them from the main properties map
        aggregation_properties = properties.pop("aggregation_properties", [])

        # Create the ProcessNorm node with its simple properties
        query = f"""
        MATCH (run:{run_label} {{run_id: $run_id}})
        MERGE (n:{norm_label} {{norm_id: $norm_id}})
        SET n = $properties
        MERGE (n)-[:`{defined_in_rel}`]->(run)
        RETURN n
        """
        params = {
            "run_id": run_id,
            "norm_id": norm_id,
            "properties": properties
        }
        execute_query(driver, query, params)

        # If there are aggregation properties, create and link them as separate nodes
        if aggregation_properties:
            agg_query = f"""
            MATCH (n:{norm_label} {{norm_id: $norm_id}})
            UNWIND $agg_props as agg_prop
            CREATE (ap:{agg_prop_label} {{name: agg_prop.name, attributeStorage: agg_prop.attributeStorage}})
            MERGE (n)-[:`{agg_rel_name}`]->(ap)
            """
            agg_params = {
                "norm_id": norm_id,
                "agg_props": aggregation_properties
            }
            execute_query(driver, agg_query, agg_params)

    print(f"Persisted {len(norms)} norms and their configurations for run {run_id}.")

# --- NEW Dashboard Logic ---

def get_dashboard_summary(driver: Driver) -> DashboardData:
    summary = {
        "overall_compliance": 1.0, "total_violations": 0, "top_violated_rules": [],
        "trend_data": [], "active_rules": []
    }
    run_label = CONFIG['analysis_run_node_label']
    diag_label = CONFIG['diagnostic_node_label']
    gen_in_rel = CONFIG['generated_in_rel_name']
    norm_label = CONFIG['process_norm_node_label']
    defined_in_rel = CONFIG['defined_in_rel_name']
    agg_result_label = CONFIG['aggregation_result_node_label']
    has_agg_rel = CONFIG['has_aggregate_rel_name']

    with driver.session(database="neo4j") as session:
        # Find the latest completed run
        latest_run_result = session.run(f"""
            MATCH (run:{run_label} {{status: 'completed'}})
            RETURN run.run_id as run_id ORDER BY run.start_time DESC LIMIT 1
        """).single()

        if not latest_run_result:
            print("No completed runs found.")
            return DashboardData(**summary)
        
        latest_run_id = latest_run_result['run_id']

        # Fetch norm descriptions
        norm_descriptions_query = f"""
        MATCH (n:{norm_label})-[:{defined_in_rel}]->(run:{run_label} {{run_id: $run_id}})
        RETURN n.norm_id as norm_id, n.description as description
        """
        norm_desc_results = session.run(norm_descriptions_query, run_id=latest_run_id)
        norm_descriptions = {r['norm_id']: r['description'] for r in norm_desc_results}

        # Fetch overall compliance and total violations
        compliance_query = f"""
        MATCH (d:{diag_label})-[:`{gen_in_rel}`]->(:{run_label} {{run_id: $run_id}})
        WITH count(d) AS total, count(CASE WHEN d.complies = false THEN 1 END) AS violations
        RETURN total, violations
        """
        result = session.run(compliance_query, run_id=latest_run_id).single()
        if result and result['total'] > 0:
            summary['total_violations'] = result['violations']
            summary['overall_compliance'] = (result['total'] - result['violations']) / result['total']

        # Fetch top violated rules
        top_rules_query = f"""
        MATCH (d:{diag_label} {{complies: false}})-[:`{gen_in_rel}`]->(:{run_label} {{run_id: $run_id}})
        RETURN d.norm_id AS rule_id, count(d) AS violations
        ORDER BY violations DESC LIMIT 5
        """
        top_rules_results = session.run(top_rules_query, run_id=latest_run_id)
        top_rules = [r.data() for r in top_rules_results]

        # Fetch aggregation results for the latest run
        aggregation_query = f"""
        MATCH (:{run_label} {{run_id: $run_id}})-[:`{has_agg_rel}`]->(agg:{agg_result_label})
        RETURN agg.norm_id as rule_id, agg.grouping_key as grouping_key, agg.compliant_nodes as compliant, agg.total_nodes as total
        """
        agg_results = session.run(aggregation_query, run_id=latest_run_id)
        
        # Process aggregation results into a dictionary for easy lookup
        disaggregated_data = {}
        for record in agg_results:
            rule_id = record['rule_id']
            if rule_id not in disaggregated_data:
                disaggregated_data[rule_id] = []
            
            total = record.get('total') or record.get('total_instances') or record.get('total_entities') or 0
            compliant = record.get('compliant') or record.get('compliant_instances') or record.get('compliant_entities') or 0
            
            if total > 0:
                violations = total - compliant
                grouping_key = record['grouping_key']
                # Ensure grouping_key is a string
                value = str(grouping_key[0]) if isinstance(grouping_key, list) and grouping_key else str(grouping_key)

                disaggregated_data[rule_id].append({
                    "value": value,
                    "violations": violations
                })

        # Combine top rules with their disaggregated data
        final_top_rules = []
        for rule in top_rules:
            rule_id = rule['rule_id']
            disaggregated_violations = []
            total_violations_for_rule = rule['violations'] # Default value

            if rule_id in disaggregated_data:
                # If we have aggregated data, use it as the source of truth for violations
                # to ensure consistency in percentages.
                rule_disaggregated_data = disaggregated_data[rule_id]
                total_from_agg = sum(item['violations'] for item in rule_disaggregated_data)
                
                if total_from_agg > 0:
                    total_violations_for_rule = total_from_agg # Override with more precise total
                    for item in rule_disaggregated_data:
                        percentage = item['violations'] / total_violations_for_rule
                        disaggregated_violations.append(
                            DisaggregatedViolation(value=item['value'], percentage=percentage)
                        )

            final_top_rules.append(TopRule(
                rule_id=rule_id,
                description=norm_descriptions.get(rule_id, "Unknown Rule"),
                violations=total_violations_for_rule,
                disaggregated_violations=disaggregated_violations if disaggregated_violations else None
            ))
        summary['top_violated_rules'] = final_top_rules

        # Fetch trend data
        trend_query = f"""
        MATCH (run:{run_label} {{status: 'completed', run_type: 'scheduled'}})
        WITH run ORDER BY run.start_time DESC LIMIT 6
        MATCH (d:{diag_label} {{complies: false}})-[:`{gen_in_rel}`]->(run)
        RETURN 
            coalesce(run.schedule, "W" + toString(run.start_time.week)) AS period, 
            count(d) AS violations
        """
        summary['trend_data'] = [TrendPoint(**record.data()) for record in session.run(trend_query)]

        # Fetch active rules
        active_rules_query = f"""
        MATCH (n:{norm_label})-[:{defined_in_rel}]->(run:{run_label} {{run_id: $run_id}})
        WHERE n.enabled = true
        RETURN n
        """
        active_rules_results = session.run(active_rules_query, run_id=latest_run_id)
        active_rules = []
        for record in active_rules_results:
            norm = record['n']
            monitored = []
            if 'activity_a' in norm: monitored.append(norm['activity_a'])
            if 'activity_b' in norm: monitored.append(norm['activity_b'])
            if 'entity_type_a' in norm: monitored.append(norm['entity_type_a'])
            if 'entity_type_b' in norm: monitored.append(norm['entity_type_b'])
            if 'context_entity_type' in norm: monitored.append(norm['context_entity_type'])
            if 'target_activity' in norm: monitored.append(norm['target_activity'])
            if 'target_name' in norm: monitored.append(norm['target_name'])
            active_rules.append(ActiveRule(
                rule_id=norm['norm_id'], 
                description=norm['description'],
                status='Active', 
                monitored_objects=list(set(monitored))
            ))
        summary['active_rules'] = active_rules
    
    return DashboardData(**summary)

# --- FastAPI Endpoints (Updated) ---

@app.post("/api/dashboard/summary", response_model=DashboardData)
async def dashboard_summary():
    driver = get_neo4j_driver()
    if not driver:
        raise HTTPException(status_code=503, detail="Could not connect to Neo4j database.")
    try:
        return get_dashboard_summary(driver)
    finally:
        if driver: driver.close()

@app.post("/api/run-analysis")
async def perform_analysis(request: NormRequest):
    try:
        analysis_output = run_analysis_from_request(request)
        return {"results": analysis_output}
    except Exception as e:
        print(f"Error during analysis: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {e}")

@app.post("/api/entity-types")
async def get_entity_types(request: ConfigForTypes):
    driver = get_neo4j_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Could not connect to Neo4j database.")
    config = request.config
    query = f"MATCH (n:{config['entityNodeLabel']}) WHERE n.{config['entityFilterProperty']} IS NOT NULL RETURN DISTINCT n.{config['entityFilterProperty']} AS type"
    results = execute_query(driver, query)
    driver.close()
    return {"types": [r['type'] for r in results] if results else []}

@app.post("/api/activity-types")
async def get_activity_types(request: ConfigForTypes):
    driver = get_neo4j_driver()
    if not driver:
        raise HTTPException(status_code=500, detail="Could not connect to Neo4j database.")
    config = request.config
    query = f"MATCH (n:{config['eventNodeLabel']}) WHERE n.{config['activityProperty']} IS NOT NULL RETURN DISTINCT n.{config['activityProperty']} AS type"
    results = execute_query(driver, query)
    driver.close()
    return {"types": [r['type'] for r in results] if results else []}



if __name__ == "__main__":
    print("Starting FastAPI server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)




