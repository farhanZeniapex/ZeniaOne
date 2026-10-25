import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

async def test_groq_voice_llm():
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    messages = [
        {"role": "system", "content": "You are Zenia One, a helpful AI voice assistant."}
    ]

    payload = {
        "model": "openai/gpt-oss-20b", 
        "messages": messages,
        "temperature": 0.5,
        "max_tokens": 500
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json=payload, timeout=10.0)
            print(f"HTTP STATUS: {resp.status_code}")
            print(f"RESPONSE BODY: {resp.text}")
    except Exception as e:
        print(f"Error fetching from Groq: {e}")

if __name__ == "__main__":
    asyncio.run(test_groq_voice_llm())
