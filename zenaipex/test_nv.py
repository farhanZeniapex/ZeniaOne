import asyncio
import os
import httpx

from dotenv import load_dotenv
load_dotenv()

async def test_nvidia():
    NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY_1")
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "nvidia/nemotron-3.5-lightning-30b-a3b",
        "messages": [{"role": "user", "content": "What is ZeniaONE?"}],
        "max_tokens": 150
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload)
        print('Status:', resp.status_code)
        print('Body:', resp.text)

asyncio.run(test_nvidia())
