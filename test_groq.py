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
        {"role": "system", "content": "You are Zenia One, a helpful AI voice assistant."},
        {"role": "user", "content": "Hello?"},
        {"role": "assistant", "content": "Hello, I am Zenia One assistant. How can I help you today?"},
        {"role": "user", "content": "How are you?"}
    ]

    payload = {
        "model": "openai/gpt-oss-20b", 
        "messages": messages,
        "temperature": 0.5,
        "max_tokens": 500
    }

    try:
        async with httpx.AsyncClient() as client:
            print(f"Requesting: {url} with model {payload['model']}")
            resp = await client.post(url, headers=headers, json=payload, timeout=10.0)
            print(f"[GROQ][VOICE] HTTP STATUS: {resp.status_code}")
            print(f"[GROQ][VOICE] RESPONSE BODY: {resp.text}")
            resp.raise_for_status()
            data = resp.json()
            print("SUCCESS! Response:")
            print(data["choices"][0]["message"]["content"])
    except Exception as e:
        print(f"Error fetching from Groq: {e}")

async def test_groq_models():
    url = "https://api.groq.com/openai/v1/models"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                models = [m["id"] for m in data.get("data", [])]
                print(f"Available models: {models}")
            else:
                print(f"Failed to fetch models: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"Error fetching models: {e}")

if __name__ == "__main__":
    asyncio.run(test_groq_voice_llm())
    asyncio.run(test_groq_models())
