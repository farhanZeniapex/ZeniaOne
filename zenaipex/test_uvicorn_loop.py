import sys
import os
import asyncio

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
app = FastAPI()

@app.get('/loop')
def check_loop():
    loop = asyncio.get_running_loop()
    return {'loop_type': str(type(loop))}
