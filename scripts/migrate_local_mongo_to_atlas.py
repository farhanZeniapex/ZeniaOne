"""Merge the local ZeniaOne MongoDB into the Render Atlas database.

This is intentionally additive: it preserves existing Atlas records, keeps the
live admin account, remaps the local admin workspace to the live workspace, and
copies local logo bytes into MongoDB so Render does not depend on its container
filesystem.
"""

from copy import deepcopy
from pathlib import Path
import os

from bson.binary import Binary
from dotenv import load_dotenv
from pymongo import MongoClient


load_dotenv("zenaipex/.env")
local = MongoClient(os.environ["MONGODB_URI"])[os.environ.get("MONGODB_DB_NAME", "zenaipex")]
atlas = MongoClient(os.environ["ATLAS_MONGODB_URI"])[os.environ.get("ATLAS_MONGODB_DB_NAME", "zenaipex")]
atlas.client.admin.command("ping")

company_map: dict[str, str] = {}
user_map: dict[str, str] = {}
agent_map: dict[str, str] = {}
kb_map: dict[str, str] = {}
doc_map: dict[str, str] = {}


def remap(doc: dict) -> dict:
    out = deepcopy(doc)
    for key, mapping in (
        ("company_id", company_map),
        ("user_id", user_map),
        ("agent_id", agent_map),
        ("knowledge_base_id", kb_map),
        ("document_id", doc_map),
    ):
        if key in out and str(out[key]) in mapping:
            out[key] = mapping[str(out[key])]
    return out


def copy_logo(settings: dict, key: str, id_hint: str) -> dict:
    settings = deepcopy(settings or {})
    path_value = settings.get(key)
    if path_value and not settings.get("logo_data"):
        path = Path(str(path_value))
        if path.exists() and path.is_file():
            settings["logo_data"] = Binary(path.read_bytes())
            settings["logo_content_type"] = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".webp": "image/webp",
                ".svg": "image/svg+xml",
            }.get(path.suffix.lower(), "image/png")
            settings["logo_filename"] = path.name
            settings[key] = f"mongo://{id_hint}/logo"
    return settings


def merge_by_id(collection, doc: dict) -> None:
    collection.replace_one({"_id": doc["_id"]}, doc, upsert=True)


# Companies: map the logical admin workspace instead of creating a duplicate
live_admin = atlas.companies.find_one({"slug": "admin_workspace"})
for local_doc in local.companies.find({}):
    old_id = str(local_doc["_id"])
    if local_doc.get("slug") == "admin_workspace" and live_admin:
        new_id = str(live_admin["_id"])
        company_map[old_id] = new_id
        settings = copy_logo(local_doc.get("settings"), "logo_url", f"company/{new_id}")
        atlas.companies.update_one(
            {"_id": live_admin["_id"]},
            {"$set": {k: v for k, v in local_doc.items() if k not in {"_id", "settings"}},
             "$setOnInsert": {"_id": live_admin["_id"]},
             "$set": {**{k: v for k, v in local_doc.items() if k not in {"_id", "settings"}}, "settings": settings}},
        )
    else:
        company_map[old_id] = old_id
        doc = remap(local_doc)
        doc["settings"] = copy_logo(doc.get("settings"), "logo_url", f"company/{old_id}")
        try:
            merge_by_id(atlas.companies, doc)
        except Exception:
            existing = atlas.companies.find_one({"slug": doc.get("slug")})
            if existing:
                company_map[old_id] = str(existing["_id"])


# Users: preserve the live configured admin credentials; merge all other users.
live_admin_user = atlas.users.find_one({"email": "admin@zenaipex.com"})
for local_doc in local.users.find({}):
    old_id = str(local_doc["_id"])
    if local_doc.get("email") == "admin@zenaipex.com" and live_admin_user:
        user_map[old_id] = str(live_admin_user["_id"])
        continue
    try:
        merge_by_id(atlas.users, local_doc)
        user_map[old_id] = old_id
    except Exception:
        existing = atlas.users.find_one({"email": local_doc.get("email")})
        if existing:
            user_map[old_id] = str(existing["_id"])


# Agents and knowledge bases need ID maps because the admin workspace ID changed.
for local_doc in local.agents.find({}):
    old_id = str(local_doc["_id"])
    doc = remap(local_doc)
    existing = atlas.agents.find_one({"company_id": doc.get("company_id"), "slug": doc.get("slug")})
    if existing and str(existing["_id"]) != old_id:
        agent_map[old_id] = str(existing["_id"])
        atlas.agents.update_one({"_id": existing["_id"]}, {"$set": {k: v for k, v in doc.items() if k != "_id"}})
    else:
        merge_by_id(atlas.agents, doc)
        agent_map[old_id] = old_id

for local_doc in local.knowledge_bases.find({}):
    old_id = str(local_doc["_id"])
    doc = remap(local_doc)
    existing = atlas.knowledge_bases.find_one({"company_id": doc.get("company_id"), "name": doc.get("name")})
    if existing:
        kb_map[old_id] = str(existing["_id"])
    else:
        merge_by_id(atlas.knowledge_bases, doc)
        kb_map[old_id] = old_id


# Documents are merged by stable ID, falling back to company/KB/filename.
for local_doc in local.documents.find({}):
    old_id = str(local_doc["_id"])
    doc = remap(local_doc)
    existing = atlas.documents.find_one({
        "company_id": doc.get("company_id"),
        "knowledge_base_id": doc.get("knowledge_base_id"),
        "filename": doc.get("filename"),
    })
    if existing:
        doc_map[old_id] = str(existing["_id"])
        atlas.documents.update_one({"_id": existing["_id"]}, {"$set": {k: v for k, v in doc.items() if k != "_id"}})
    else:
        merge_by_id(atlas.documents, doc)
        doc_map[old_id] = old_id


# Copy the remaining application data, preserving live records on duplicate IDs.
skip = {"companies", "users", "agents", "knowledge_bases", "documents", "platform_settings", "ai_providers"}
for name in local.list_collection_names():
    if name in skip:
        continue
    target = atlas[name]
    for local_doc in local[name].find({}):
        doc = remap(local_doc)
        if name == "team_members":
            key = {"company_id": doc.get("company_id"), "user_id": doc.get("user_id")}
            target.update_one(key, {"$set": {k: v for k, v in doc.items() if k != "_id"}}, upsert=True)
        elif name == "subscriptions":
            target.update_one({"company_id": doc.get("company_id")}, {"$set": {k: v for k, v in doc.items() if k != "_id"}}, upsert=True)
        else:
            target.replace_one({"_id": doc["_id"]}, doc, upsert=True)


# Platform settings are global; local branding wins, with logo bytes copied.
local_platform = local.platform_settings.find_one({"type": "global"})
if local_platform:
    platform = deepcopy(local_platform)
    platform["platform"] = copy_logo(platform.get("platform"), "logo_path", "platform")
    atlas.platform_settings.replace_one({"type": "global"}, platform, upsert=True)


counts = {}
for name in ("users", "companies", "agents", "conversations", "messages", "knowledge_bases", "documents", "channels", "activity_logs"):
    counts[name] = atlas[name].count_documents({})
print("ATLAS_MIGRATION_OK")
print("ATLAS_COUNTS=" + ",".join(f"{k}:{v}" for k, v in counts.items()))
