from pymongo import MongoClient

client = MongoClient('mongodb://localhost:27017')
db = client['zenaipex']

res = db.custom_voices.update_many(
    {'name': {'$in': ['OM', 'FK', 'Saurav', 'Farhan', 'Faruu', 'faru']}},
    {'$set': {'gender': 'Male'}}
)
print('Updated', res.modified_count, 'voices')
