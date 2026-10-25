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
        "model": "openai/gpt-oss-120b",
        "messages": [{"role": "user", "content": "What is ZeniaONE?"}],
        "max_tokens": 1024
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, json=payload, timeout=30.0)
        print('Status:', resp.status_code)
        import json
        try:
            data = resp.json()
            print('Content:', repr(data.get("choices", [{}])[0].get("message", {}).get("content")))
        except Exception as e:
            print('Body:', resp.text)

asyncio.run(test_groq())
