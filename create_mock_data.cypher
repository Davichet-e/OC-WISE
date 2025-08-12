// Clean up previous mock data to ensure a fresh start
MATCH (d:Diagnostic) DETACH DELETE d;
MATCH (p:ProcessNorm) DETACH DELETE p;
MATCH (a:AnalysisRun) DETACH DELETE a;
MATCH (ar:AggregationResult) DETACH DELETE ar;
MATCH (ap:AggregationProperty) DETACH DELETE ap;
MATCH (pd:ProcessDefinition) DETACH DELETE pd;

// --- 1. Create Core Nodes ---
CREATE (run:AnalysisRun { run_id: "mock_run_001", run_type: "scheduled", start_time: datetime(), status: "completed", schedule: "W32" });
CREATE (pn1:ProcessNorm { norm_id: "rule_001", description: "Payment must be recorded within 48 hours of invoice receipt.", enabled: true });
CREATE (pn2:ProcessNorm { norm_id: "rule_002", description: "Every 'Order' must have an associated 'Item' before shipping.", enabled: true });
CREATE (pn3:ProcessNorm { norm_id: "rule_003", description: "A 'Senior Manager' must approve any order over €5000.", enabled: true });
CREATE (pn4:ProcessNorm { norm_id: "rule_004", description: "Quality check must precede shipping.", enabled: false });

// --- 2. Link Norms to Run ---
MATCH (run:AnalysisRun {run_id: "mock_run_001"})
MATCH (p:ProcessNorm)
MERGE (p)-[:DEFINED_IN]->(run);

// --- 3. Define Aggregation Properties ---
MATCH (pn1:ProcessNorm {norm_id: "rule_001"})
CREATE (ap1:AggregationProperty {name: "region", attributeStorage: "property"})
MERGE (pn1)-[:DEFINES_AGGREGATION_BY]->(ap1);

// --- 4. Create Diagnostic Data ---
MATCH (run:AnalysisRun {run_id: "mock_run_001"})
// For rule_001: 150 violations + 850 compliant cases = 1000 total
UNWIND range(1, 150) AS i CREATE (d:Diagnostic { norm_id: "rule_001", complies: false })-[:GENERATED_IN]->(run);
UNWIND range(1, 850) AS i CREATE (d:Diagnostic { norm_id: "rule_001", complies: true })-[:GENERATED_IN]->(run);

// For rule_002: 98 violations + 202 compliant cases = 300 total
UNWIND range(1, 98) AS i CREATE (d:Diagnostic { norm_id: "rule_002", complies: false })-[:GENERATED_IN]->(run);
UNWIND range(1, 202) AS i CREATE (d:Diagnostic { norm_id: "rule_002", complies: true })-[:GENERATED_IN]->(run);

// For rule_003: 45 violations + 155 compliant cases = 200 total
UNWIND range(1, 45) AS i CREATE (d:Diagnostic { norm_id: "rule_003", complies: false })-[:GENERATED_IN]->(run);
UNWIND range(1, 155) AS i CREATE (d:Diagnostic { norm_id: "rule_003", complies: true })-[:GENERATED_IN]->(run);

// For rule_004: 21 violations + 79 compliant cases = 100 total
UNWIND range(1, 21) AS i CREATE (d:Diagnostic { norm_id: "rule_004", complies: false })-[:GENERATED_IN]->(run);
UNWIND range(1, 79) AS i CREATE (d:Diagnostic { norm_id: "rule_004", complies: true })-[:GENERATED_IN]->(run);

// --- 5. Create Aggregation Results and Link Them ---
MATCH (run:AnalysisRun {run_id: "mock_run_001"})
MATCH (ap:AggregationProperty {name: "region"})
WITH run, ap
UNWIND [
  {group: ["Region A"], total: 300, compliant: 210},
  {group: ["Region B"], total: 400, compliant: 355},
  {group: ["Region C"], total: 300, compliant: 285}
] AS agg_data
CREATE (agg:AggregationResult {
  norm_id: "rule_001",
  grouping_key: agg_data.group,
  total_nodes: agg_data.total,
  compliant_nodes: agg_data.compliant
})
MERGE (run)-[:HAS_AGGREGATE]->(agg)
MERGE (agg)-[:AGGREGATED_BY]->(ap);

// --- 6. Create Historical Trend Data ---
CREATE (run_w31:AnalysisRun { run_id: "mock_run_w31", run_type: "scheduled", start_time: datetime() - duration({days: 7}), status: "completed", schedule: "W31" })
WITH run_w31 UNWIND range(1, 78) as i CREATE (d:Diagnostic {norm_id: "rule_001", complies: false})-[:GENERATED_IN]->(run_w31);
CREATE (run_w30:AnalysisRun { run_id: "mock_run_w30", run_type: "scheduled", start_time: datetime() - duration({days: 14}), status: "completed", schedule: "W30" })
WITH run_w30 UNWIND range(1, 80) as i CREATE (d:Diagnostic {norm_id: "rule_001", complies: false})-[:GENERATED_IN]->(run_w30);
CREATE (run_w29:AnalysisRun { run_id: "mock_run_w29", run_type: "scheduled", start_time: datetime() - duration({days: 21}), status: "completed", schedule: "W29" })
WITH run_w29 UNWIND range(1, 65) as i CREATE (d:Diagnostic {norm_id: "rule_001", complies: false})-[:GENERATED_IN]->(run_w29);
CREATE (run_w28:AnalysisRun { run_id: "mock_run_w28", run_type: "scheduled", start_time: datetime() - duration({days: 28}), status: "completed", schedule: "W28" })
WITH run_w28 UNWIND range(1, 75) as i CREATE (d:Diagnostic {norm_id: "rule_001", complies: false})-[:GENERATED_IN]->(run_w28);
CREATE (run_w27:AnalysisRun { run_id: "mock_run_w27", run_type: "scheduled", start_time: datetime() - duration({days: 35}), status: "completed", schedule: "W27" })
WITH run_w27 UNWIND range(1, 50) as i CREATE (d:Diagnostic {norm_id: "rule_001", complies: false})-[:GENERATED_IN]->(run_w27);

// --- 7. Create Example Process Definitions and Link Norms ---
CREATE (pd1:ProcessDefinition { definition_id: 'def_mock_01', name: 'Financial Controls', schedule: 'daily' });
CREATE (pd2:ProcessDefinition { definition_id: 'def_mock_02', name: 'Logistics & Shipping', schedule: 'weekly' });
CREATE (pd3:ProcessDefinition { definition_id: 'def_mock_03', name: 'Full Process Audit', schedule: 'monthly' });

// Link norms to 'Financial Controls'
MATCH (pd:ProcessDefinition {definition_id: 'def_mock_01'})
MATCH (pn:ProcessNorm) WHERE pn.norm_id IN ["rule_001", "rule_003"]
MERGE (pd)-[:CONTAINS_NORM]->(pn);

// Link norms to 'Logistics & Shipping'
MATCH (pd:ProcessDefinition {definition_id: 'def_mock_02'})
MATCH (pn:ProcessNorm) WHERE pn.norm_id IN ["rule_002", "rule_004"]
MERGE (pd)-[:CONTAINS_NORM]->(pn);

// Link all norms to 'Full Process Audit'
MATCH (pd:ProcessDefinition {definition_id: 'def_mock_03'})
MATCH (pn:ProcessNorm)
MERGE (pd)-[:CONTAINS_NORM]->(pn);
