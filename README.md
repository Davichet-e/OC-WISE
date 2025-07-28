# OC-WISE

- Python version: 3.13
- [Node](https://nodejs.org/en/download) version: 22
- Neo4j version: 5.24

To run the backend, just install requirements from `requirements.txt` (`pip install -r requirements.txt`). Then run: `python backend.py`.

For the frontend, install the dependencies using `npm install`, then run `npm run dev`.

To run the Entity to Entity Process Norms, you need the DF_ENTITY relationship, it can be created running the `create_df_entity_relationship` function in `backend.py`.

# Data
To create an EKG from an OCEL 2.0 file. Execute first `create_ekg/create_ekg.py` using: `cd create_ekg && python create_ekg.py`, follow the instructions on the beginning of the file. An example dataset can be found in https://zenodo.org/records/8412920

Then to create the DF relationships, adapt and execute the following Cypher command:
```cypher
MATCH (n:Entity)
        MATCH (n)<-[:CORR]-(e)
        WITH n, e AS nodes ORDER BY datetime(e.time), ID(e)
        WITH n, collect(nodes) AS event_node_list
        UNWIND range(0, size(event_node_list)-2) AS i
        WITH n, event_node_list[i] AS e1, event_node_list[i+1] AS e2
        
        MERGE (e1)-[df:DF {EntityType: n.type, id:n.id}]->(e2)
```

Command taken from: https://github.com/multi-dimensional-process-mining/eventgraph_tutorial/blob/main/order_process/2_build_event_knowledge_graph.py
