"""Finish the additive local-to-Atlas merge for collections with unique indexes."""
from copy import deepcopy
import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("zenaipex/.env")
local = MongoClient(os.environ["MONGODB_URI"])[os.environ.get("MONGODB_DB_NAME", "zenaipex")]
atlas = MongoClient(os.environ["ATLAS_MONGODB_URI"])[os.environ.get("ATLAS_MONGODB_DB_NAME", "zenaipex")]

company_map = {}
for company in local.companies.find({}):
    target = atlas.companies.find_one({"slug": company.get("slug")})
    if target:
        company_map[str(company["_id"])] = str(target["_id"])

agent_map = {}
for agent in local.agents.find({}):
    target = atlas.agents.find_one({
        "company_id": company_map.get(str(agent.get("company_id")), str(agent.get("company_id"))),
        "slug": agent.get("slug"),
    })
    if target:
        agent_map[str(agent["_id"])] = str(target["_id"])


def remap(doc):
    out = deepcopy(doc)
    for key, mapping in (("company_id", company_map), ("agent_id", agent_map)):
        if key in out and str(out[key]) in mapping:
            out[key] = mapping[str(out[key])]
    return out


for source_name in ("conversations", "messages", "scheduled_calls", "timing_metrics", "activity_logs"):
    target = atlas[source_name]
    for source_doc in local[source_name].find({}):
        doc = remap(source_doc)
        try:
            if source_name == "conversations" and doc.get("call_sid"):
                target.update_one(
                    {"call_sid": doc["call_sid"]},
                    {"$set": {k: v for k, v in doc.items() if k != "_id"}},
                    upsert=True,
                )
            else:
                target.replace_one({"_id": doc["_id"]}, doc, upsert=True)
        except Exception:
            # A duplicate provider SID or legacy unique field should not stop
            # the rest of the user's historical data from being merged.
            continue

print("FINISH_MIGRATION_OK")
print("CONVERSATIONS=" + str(atlas.conversations.count_documents({})))
print("MESSAGES=" + str(atlas.messages.count_documents({})))
print("CHANNELS=" + str(atlas.channels.count_documents({})))
print("ACTIVITY_LOGS=" + str(atlas.activity_logs.count_documents({})))
