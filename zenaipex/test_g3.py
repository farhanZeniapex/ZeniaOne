import asyncio
import os
import httpx

from dotenv import load_dotenv
load_dotenv()

async def test_groq():
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.1-70b-versatile",
        "messages": [{"role": "user", "content": "What is ZeniaONE?"}],
        "max_tokens": 150
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload)
        print('Status:', resp.status_code)
        print('Body:', resp.text)

asyncio.run(test_groq())
