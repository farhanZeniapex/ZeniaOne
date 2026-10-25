# EchoSelf

A voice assistant that records or uploads an authorized voice sample, transcribes questions, asks a local LLM, and speaks the answer in that voice. Sarvam is the default speech provider for fast Hindi, Hinglish, and English cloning; local Chatterbox remains available as a fallback.

## Stack

- **Speech to text:** Sarvam Saaras v4 (or local Faster-Whisper fallback)
- **Answers:** Ollama (`llama3.2:3b` by default)
- **Voice cloning:** Sarvam Voice Cloning API (or local Chatterbox fallback)
- **Interface/API:** Vanilla browser UI + FastAPI

Sarvam starts with signup credits and requires an API key. Ollama continues to run on your computer.

## Configure Sarvam

Create an API key in the Sarvam dashboard. Open `.env` and set it here; never put the key in browser code or commit it:

```env
VOICE_PROVIDER=sarvam
SARVAM_API_KEY=your_key_here
```

Set `VOICE_PROVIDER=local` if you want to use Faster-Whisper and Chatterbox without Sarvam.

## Exotel phone calls

EchoSelf exposes a bidirectional Exotel AgentStream endpoint at `/exotel/media`. It accepts Exotel's raw PCM media events, detects the end of each caller turn, transcribes with Sarvam, asks Ollama, and returns cloned speech over the same WebSocket.

1. Set a long random value as `EXOTEL_STREAM_TOKEN` in `.env`.
2. Deploy the app to a public HTTPS host or expose it through a secure tunnel. `127.0.0.1` is not reachable by Exotel.
3. In an inbound Exotel App Bazaar flow, add the **Voicebot** applet.
4. Set its WebSocket URL to:

```text
wss://YOUR-PUBLIC-HOST/exotel/media?token=YOUR_TOKEN&language=hi
```

Use `language=en`, `hi`, `gu`, or `auto`. Configure the stream as bidirectional PCM linear16. The handler reads Exotel's negotiated sample rate from the `start` event; 8 kHz is the default.

For outbound bot-only calls, use Exotel's Connect Voice AI API with the same `StreamUrl` and `StreamType=bidirectional`.

## Setup (Windows PowerShell)

Use Python 3.11; Chatterbox's ML dependencies may not support newer Python releases yet.

```powershell
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements-ai.txt
```

Install [Ollama](https://ollama.com/download), then download the small default model:

```powershell
ollama pull llama3.2:3b
```

Start the app:

```powershell
uvicorn app:app --reload
```

Open <http://127.0.0.1:8000>. Allow microphone access when prompted.

## Notes

- The first transcription and cloned reply are slower because model files must download and load.
- An NVIDIA GPU is recommended for quick cloning, but Chatterbox can fall back to CPU.
- Use a clean 10–20 second sample with one speaker and little background noise.
- Change the Ollama model or Whisper size with the environment variables shown in `.env.example`.
- Audio is saved under `data/` and is excluded from Git.

## Responsible use

Only clone your own voice or a voice you have explicit permission to use. Do not use generated audio to impersonate, deceive, bypass identity checks, or commit fraud. Chatterbox includes an inaudible watermark in generated speech.
