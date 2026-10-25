import asyncio
import os
import json
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import json_util

# Set your MongoDB connection URI and DB name here
MONGODB_URI = "mongodb://localhost:27017"
DB_NAME = "zenaipex"
BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backups")

async def backup_database():
    print("Starting database backup...")
    
    # Create backups folder if it doesn't exist
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
        
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]
    
    # Generate timestamp for the backup filename
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_path = os.path.join(BACKUP_DIR, f"backup_{timestamp}.json")
    
    backup_data = {}
    collections = await db.list_collection_names()
    
    for coll_name in collections:
        print(f"Backing up collection: {coll_name}...")
        docs = await db[coll_name].find({}).to_list(length=None)
        backup_data[coll_name] = docs
        
    # Write to a single JSON file
    with open(backup_path, 'w', encoding='utf-8') as f:
        # Use json_util to handle MongoDB specific types like ObjectId and datetime
        json.dump(backup_data, f, default=json_util.default, indent=2)
        
    print(f"Success! Backup successfully saved to: {backup_path}")
    print("Ab agar aap galti se kuch delete bhi kar denge, to is file se data wapas laya ja sakega!\n")

if __name__ == "__main__":
    asyncio.run(backup_database())
