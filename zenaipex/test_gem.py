import asyncio
import os
import httpx

from dotenv import load_dotenv
load_dotenv()

async def test_gemini():
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    headers = {
        "Authorization": f"Bearer {GEMINI_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "gemini-1.5-flash",
        "messages": [{"role": "user", "content": "What is ZeniaONE?"}],
        "max_tokens": 150
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload)
        print('Status:', resp.status_code)
        print('Body:', resp.text)

asyncio.run(test_gemini())
