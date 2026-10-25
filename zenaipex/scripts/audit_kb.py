import asyncio
import os
import json
from dotenv import load_dotenv
import sys
sys.path.append(r'd:\zeniaOne-Voice-Assistant\zenaipex')
load_dotenv('d:\\zeniaOne-Voice-Assistant\\zenaipex\\.env')

from zenaipex.core.database import col_documents, col_knowledge_bases, col_companies, col_agents, connect_db

async def audit():
    await connect_db()
    print("--- DB KNOWLEDGE AUDIT ---")
    files = [
        "ZeniaOne_Platform_Architecture_Guide.md",
        "ZeniaHR-Admin-Guide.pdf",
        "stage_zeniahr_com_dashboard.txt",
        "ZENIAPEX_Products_Details.txt",
        "www_zeniapex_com_.txt",
        "www_zeniahr_com_.txt"
    ]
    
    docs = await col_documents().find({"filename": {"$in": files}}).to_list(length=100)
    for doc in docs:
        print(f"[KNOWLEDGE_INDEX_AUDIT]")
        print(f"file={doc['filename']}")
        print(f"indexed={doc.get('status') == 'completed'}")
        print(f"chunks={doc.get('chunk_count', 'Unknown')}")
        print(f"namespace={doc.get('company_id')}")
        print(f"product={doc.get('metadata', {}).get('product', 'Unknown')}")
        print(f"company_id={doc.get('company_id')}")
        print(f"kb_id={doc.get('knowledge_base_id')}")
        
    print("\n--- AGENT RAG STATUS ---")
    agents = await col_agents().find({}).to_list(length=10)
    for a in agents:
        print(f"Agent ID: {a['_id']}, Name: {a.get('name')}, KB_ID: {a.get('knowledge_base_id')}")

asyncio.run(audit())
