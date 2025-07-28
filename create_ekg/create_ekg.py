# Taken from https://github.com/multi-dimensional-process-mining/eventgraph_tutorial/blob/main/ocel_ekg/main.py

# Import OCEL2 logs in .csv format into EKG#

import os

# path where input file is located
#
# IMPORTANT: by default Neo4j does not allow importing data from arbitrary local URLs, e.g., this directoy
# to allow Neo4j importing a file from this directoy:
#
# 1. Find the neo4j.conf file for your Neo4j installation. See https://neo4j.com/docs/operations-manual/current/configuration/file-locations/
#    If you are using Neo4j Desktop, this is located under <yourGraph> > Manage > Settings (you have to stop the DB instance first)
# 2. Comment out this line (by adding # at the start of the line):
#         server.directories.import=import
# 3. Uncomment this line to allow CSV import from file URL:
#         #dbms.security.allow_csv_import_from_file_urls=true
# 4. Restart Neo4j
#
inputPath = './data/'
# You can obtain the input file from https://zenodo.org/records/8412920
inputFile = 'ocel2-p2p.json'
import pm4py
from neo4j import GraphDatabase

# connection to Neo4J database
# the queries in this file make use of the APOC library, make sure to have the APOC plugin installed for this DB instance
driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "12345678"))

log = pm4py.read.read_ocel2("data/ocel2-p2p.json") #Input Filename
df = log.get_extended_table()

df.to_csv("data/ocel2-p2p.csv")

from ocel2_import import OcelImport

oi = OcelImport(driver)
oi.readJsonOcel(inputPath+inputFile)
oi.prepare_objects()
oi.prepare_events()

oi.ocel2_import_objects()
oi.ocel2_import_object_attributes()
oi.ocel2_import_events()
oi.ocel2_import_e2o_relation()
oi.ocel2_materialize_last_object_state()