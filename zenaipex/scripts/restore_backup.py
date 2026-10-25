import asyncio
import os
import json
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from bson import json_util

MONGODB_URI = "mongodb://localhost:27017"
DB_NAME = "zenaipex"

async def restore_database(backup_file):
    if not os.path.exists(backup_file):
        print(f"❌ Backup file not found: {backup_file}")
        return

    print(f"Loading backup data from {backup_file}...")
    with open(backup_file, 'r', encoding='utf-8') as f:
        # json_util.object_hook converts the special MongoDB objects (like {"$oid": "..."}) back to actual ObjectIds
        backup_data = json.load(f, object_hook=json_util.object_hook)

    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]
    
    print("⚠️ WARNING: This will overwrite existing documents with the same ID.")
    confirm = input("Type 'yes' to proceed: ")
    if confirm.lower() != 'yes':
        print("Restore cancelled.")
        return

    for coll_name, docs in backup_data.items():
        if not docs:
            continue
            
        print(f"Restoring {len(docs)} documents to collection '{coll_name}'...")
        
        # Upsert documents (replace if exists, insert if new)
        for doc in docs:
            await db[coll_name].replace_one({'_id': doc['_id']}, doc, upsert=True)

    print("✅ Restore complete! Data is back.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python restore_backup.py <path_to_backup.json>")
    else:
        asyncio.run(restore_database(sys.argv[1]))
