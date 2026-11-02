from pymongo import MongoClient
client = MongoClient('mongodb://localhost:27017/')
db = client['zenaipex']

upd = {"DOLLARset": {"status": "failed"}}
upd = {k.replace("DOLLAR", "$"): v for k, v in upd.items()}

result1 = db.conversations.update_many(
    {'status': 'active'},
    upd
)
result2 = db.conversations.update_many(
    {'status': 'calling'},
    upd
)
print(f"Updated {result1.modified_count + result2.modified_count} stuck conversations.")
