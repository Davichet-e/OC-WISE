import datetime
import io
import json
import os
import sys
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from abc import ABC, abstractmethod
from neo4j import GraphDatabase, Driver
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

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
    # --- New Attribute Storage Configuration ---
    "attribute_storage_strategy": "property",  # Can be 'property' or 'node'
    "attribute_node_label": "Attribute",
    "attribute_rel_name": "HAS_ATTRIBUTE",
    "attribute_name_property": "name",
    "attribute_value_property": "value",
}

# --- Pydantic Models ---

class NormRequest(BaseModel):
    config: Dict[str, Any]
    norms: List[Dict[str, Any]]

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
            print(query)
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

    def _generate_aggregation_query_template(
            self,
            config: Dict[str, Any],
            match_clause: str,
            grouping_properties: List[str],
            grouping_entity_alias: str,
            aggregation_expressions: List[str]
    ) -> str:

        if not grouping_properties:
            return f"""
            {match_clause}
            RETURN 'Overall' as grouping_key,
                   {',\n                   '.join(aggregation_expressions)}
            """

        attribute_storage = config.get("attribute_storage_strategy", "property")

        if attribute_storage == 'node':
            attr_rel = config.get("attribute_rel_name", "HAS_ATTRIBUTE")
            attr_label = config.get("attribute_node_label", "Attribute")
            attr_name_prop = config.get("attribute_name_property", "name")
            attr_value_prop = config.get("attribute_value_property", "value")

            match_clauses = []
            grouping_key_parts = []

            for i, prop in enumerate(grouping_properties):
                alias = f"attr_{i}"
                match_clauses.append(
                    f"OPTIONAL MATCH ({grouping_entity_alias})-[:`{attr_rel}`]->({alias}:`{attr_label}` {{ `{attr_name_prop}`: '{prop}' }})")
                grouping_key_parts.append(f"coalesce(toString({alias}.`{attr_value_prop}`), 'N/A')")

            additional_matches = "\n        ".join(match_clauses)
            grouping_key_str = f"[{', '.join(grouping_key_parts)}]"

            query = f"""
            {match_clause}
            {additional_matches}
            RETURN {grouping_key_str} as grouping_key,
                   {',\n                   '.join(aggregation_expressions)}
            """
        else:  # 'property' strategy
            grouping_key_parts = [f"coalesce(toString({grouping_entity_alias}.`{prop}`), 'N/A')" for prop in
                                  grouping_properties]
            grouping_key_str = f"[{', '.join(grouping_key_parts)}]"

            query = f"""
            {match_clause}
            RETURN {grouping_key_str} as grouping_key,
                   {',\n                   '.join(aggregation_expressions)}
            """
        return query

    def run_analysis(self, driver: Optional[Driver], config: Dict[str, Any], params: Dict[str, Any]) -> Optional[str]:
        if not driver:
            no_driver_msg = f"Analysis skipped for Norm: {self.norm_id} - No database driver."
            print(no_driver_msg)
            return no_driver_msg

        print(f"\n=== Running Analysis for Norm: {self.norm_id} ===")
        print(f"Description: {self.description}")

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
            report = format_aggregation_results(self.norm_id, self.description, agg_results)
        else:
            print("Aggregation query generation skipped or failed.")

        print(f"=== Analysis Complete for Norm: {self.norm_id} ===\n")
        return report


# --- Norm Implementations ---

class AverageTimeBetweenActivitiesNorm(ProcessNorm):
    def generate_diagnostic_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        activity_a = params.get("activity_a")
        activity_b = params.get("activity_b")
        threshold_seconds = params.get("threshold_seconds")
        threshold_condition = params.get("threshold_condition", "less than")

        if not all([activity_a, activity_b, threshold_seconds is not None]):
            print("Error [AvgTime]: Missing required parameters.")
            return None

        operator = "<" if threshold_condition == "less than" else ">"

        query = f"""
        MATCH (ev_a:{config['event_node_label']} {{ `{config['activity_property']}`: $activity_a }})
        MATCH (ev_b:{config['event_node_label']} {{ `{config['activity_property']}`: $activity_b }})
        WHERE ev_a.`{config['timestamp_property']}` < ev_b.`{config['timestamp_property']}`
        WITH ev_a, ev_b, duration.inSeconds(ev_a.`{config['timestamp_property']}`, ev_b.`{config['timestamp_property']}`) as dur
        WHERE dur IS NOT NULL
        WITH ev_a, ev_b, dur.seconds as duration_seconds, (dur.seconds {operator} $threshold_seconds) as complies
        MERGE (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id, related_id: elementId(ev_a) + '_' + elementId(ev_b) }})
        ON CREATE SET diag.complies = complies, diag.duration_seconds = duration_seconds, diag.last_checked = datetime()
        SET diag.complies = complies, diag.duration_seconds = duration_seconds, diag.last_checked = datetime()
        MERGE (ev_a)-[:{config['compliance_rel_name']}]->(diag)
        MERGE (ev_b)-[:{config['compliance_rel_name']}]->(diag)
        """
        return query, {
            "activity_a": activity_a, "activity_b": activity_b,
            "threshold_seconds": threshold_seconds, "norm_id": self.norm_id
        }

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
        entity_type_a = params.get("entity_type_a")
        entity_type_b = params.get("entity_type_b")
        if not entity_type_a or not entity_type_b:
            print("Error [EntityFollows]: entity_type_a and entity_type_b are required.")
            return None

        query = f"""
        MATCH (ea:{config['entity_node_label']} {{ `{config['entity_filter_property']}`: $entity_type_a }})
        OPTIONAL MATCH (ea)-[:`{config['df_entity_rel_name']}`]->(eb:{config['entity_node_label']} {{ `{config['entity_filter_property']}`: $entity_type_b }})
        WITH ea, (eb IS NOT NULL) as complies
        MERGE (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id, related_id: elementId(ea) }})
        ON CREATE SET diag.complies = complies, diag.last_checked = datetime()
        SET diag.complies = complies, diag.last_checked = datetime()
        MERGE (ea)-[:{config['compliance_rel_name']}]->(diag)
        """
        return query, {"entity_type_a": entity_type_a, "entity_type_b": entity_type_b, "norm_id": self.norm_id}

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
        context_entity_type = params.get("context_entity_type")
        target_activity = params.get("target_activity")
        operator = params.get("operator")
        count = params.get("count")

        if not all([context_entity_type, target_activity, operator]):
            print("Error [EventToEntity]: Missing required parameters.")
            return None

        op_map = {"exists": ">", "not exists": "=", "==": "=", "!=": "<>", ">": ">", "<": "<", ">=": ">=", "<=": "<="}
        cypher_op = op_map.get(operator)
        if not cypher_op:
            print(f"Error [EventToEntity]: Invalid operator '{operator}'.")
            return None

        if operator in ['exists', 'not exists']:
            count = 0
        elif count is None:
            print(f"Error [EventToEntity]: 'count' parameter is required for operator '{operator}'.")
            return None

        query = f"""
        MATCH (ctx:{config['entity_node_label']} {{ `{config['entity_filter_property']}`: $context_entity_type }})
        OPTIONAL MATCH (ctx)<-[:{config['corr_rel_name']}]-(ev:{config['event_node_label']} {{ `{config['activity_property']}`: $target_activity }})
        WITH ctx, count(ev) as actual_count
        WITH ctx, actual_count, (actual_count {cypher_op} $count) as complies
        MERGE (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id, related_id: elementId(ctx) }})
        ON CREATE SET diag.complies = complies, diag.actual_count = actual_count, diag.last_checked = datetime()
        SET diag.complies = complies, diag.actual_count = actual_count, diag.last_checked = datetime()
        MERGE (ctx)-[:{config['compliance_rel_name']}]->(diag)
        """
        return query, {
            "context_entity_type": context_entity_type, "target_activity": target_activity,
            "count": count, "norm_id": self.norm_id
        }

    def generate_aggregation_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        match_clause = f"MATCH (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id }})<-[:{config['compliance_rel_name']}]-(ctx) WHERE diag.actual_count IS NOT NULL"
        grouping_properties = params.get("aggregation_properties", [])
        expressions = [
            "avg(diag.duration_seconds) as avg_count",
            "min(diag.duration_seconds) as min_count",
            "max(diag.duration_seconds) as max_count",
            "count(diag) as total_entities",
            "SUM(CASE WHEN diag.complies THEN 1 ELSE 0 END) as compliant_entities"
        ]
        query = self._generate_aggregation_query_template(config, match_clause, grouping_properties, "ctx", expressions)
        return query, {"norm_id": self.norm_id}


class ActivityDirectlyFollowsNorm(ProcessNorm):
    def generate_diagnostic_query(self, config: Dict[str, Any], params: Dict[str, Any]) -> Optional[Tuple[str, Dict]]:
        activity_a = params.get("activity_a")
        activity_b = params.get("activity_b")
        forbidden = params.get("forbidden", False)
        if not activity_a or not activity_b:
            print("Error [ActivityDirectlyFollows]: activity_a and activity_b are required.")
            return None

        query = f"""
        MATCH (ev_a:{config['event_node_label']} {{ `{config['activity_property']}`: $activity_a }})
        OPTIONAL MATCH (ev_a)-[:{config['df_rel_name']}]->(ev_b:{config['event_node_label']} {{ `{config['activity_property']}`: $activity_b }})
        WITH ev_a, (ev_b IS NOT NULL) as directly_follows
        WITH ev_a, directly_follows, (directly_follows = ${not forbidden}) as complies
        MERGE (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id, related_id: elementId(ev_a) }})
        ON CREATE SET diag.complies = complies, diag.last_checked = datetime()
        SET diag.complies = complies, diag.last_checked = datetime()
        MERGE (ev_a)-[:{config['compliance_rel_name']}]->(diag)
        """
        return query, {"activity_a": activity_a, "activity_b": activity_b, "norm_id": self.norm_id}

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
        target_name = params.get("target_name")
        property_name = params.get("property_name")
        operator = params.get("operator")
        value = params.get("value")

        if not all([target_name, property_name, operator, value is not None]):
            print("Error [PropertyValue]: Missing required parameters.")
            return None

        op_map = {"==": "=", "!=": "<>", ">": ">", "<": "<", ">=": ">=", "<=": "<=", "in": "IN", "not in": "NOT IN"}
        cypher_op = op_map.get(operator)
        if not cypher_op:
            print(f"Error [PropertyValue]: Invalid operator '{operator}'.")
            return None

        attribute_storage = config.get("attribute_storage_strategy", "property")
        match_clause = self.get_node_match(config, params)
        query_params = {"value": value, "norm_id": self.norm_id, "target_name": target_name,
                        "property_name": property_name}

        if attribute_storage == 'node':
            attr_rel = config.get("attribute_rel_name", "HAS_ATTRIBUTE")
            attr_label = config.get("attribute_node_label", "Attribute")
            attr_name_prop = config.get("attribute_name_property", "name")
            attr_value_prop = config.get("attribute_value_property", "value")

            query = f"""
            {match_clause}
            WITH n
            OPTIONAL MATCH (n)-[:`{attr_rel}`]->(attr:`{attr_label}` {{ `{attr_name_prop}`: $property_name }})
            WITH n, (attr IS NOT NULL AND attr.`{attr_value_prop}` {cypher_op} $value) as complies
            MERGE (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id, related_id: elementId(n) }})
            ON CREATE SET diag.complies = complies, diag.last_checked = datetime()
            SET diag.complies = complies, diag.last_checked = datetime()
            MERGE (n)-[:{config['compliance_rel_name']}]->(diag)
            """
        else:  # 'property'
            query = f"""
            {match_clause}
            WITH n, (n.`{property_name}` IS NOT NULL AND n.`{property_name}` {cypher_op} $value) as complies
            MERGE (diag:{config['diagnostic_node_label']} {{ norm_id: $norm_id, related_id: elementId(n) }})
            ON CREATE SET diag.complies = complies, diag.last_checked = datetime()
            SET diag.complies = complies, diag.last_checked = datetime()
            MERGE (n)-[:{config['compliance_rel_name']}]->(diag)
            """
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


def parse_and_run_norms(driver: Optional[Driver], config: Dict[str, Any], data: Dict[str, Any]) -> List[str]:
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
            report = norm.run_analysis(driver, config, norm_data)
            if report:
                reports.append(report)
        except KeyError as e:
            print(f"Skipping invalid norm definition (missing {e}): {norm_data}")
        except Exception as e:
            print(f"An error occurred while running norm {norm_data.get('norm_id')}: {e}")
    return reports


def run_analysis_from_request(request_data: NormRequest) -> str:
    """
    Runs the full analysis based on the request data and captures the output.
    """
    driver = get_neo4j_driver()
    if not driver:
        return "Error: Could not connect to Neo4j database."

    # This will capture the print() statements for connection status, query execution, etc.
    old_stdout = sys.stdout
    sys.stdout = captured_output = io.StringIO()

    reports = []
    try:
        base_config = CONFIG.copy()
        # This function now returns a list of report strings
        reports = parse_and_run_norms(driver, base_config, request_data.dict())
    except Exception as e:
        print(f"\n--- UNEXPECTED ERROR ---")
        print(f"An error occurred during analysis: {e}")
        import traceback
        traceback.print_exc(file=sys.stdout)
    finally:
        sys.stdout = old_stdout
        log_output = captured_output.getvalue()
        driver.close()
        print("\nNeo4j connection closed.")

    # Combine the logs and the structured reports
    full_output = log_output + "\n\n" + "\n".join(reports)
    return full_output


@app.post("/api/run-analysis")
async def api_run_analysis(request: NormRequest):
    """
    API endpoint to receive norm configuration and run the analysis.
    """
    try:
        results = run_analysis_from_request(request)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    print("Starting FastAPI server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)




