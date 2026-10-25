from fastapi import FastAPI
import asyncio
import sys

app = FastAPI()

@app.on_event('startup')
async def startup():
    print("LOOP TYPE:", type(asyncio.get_running_loop()))

