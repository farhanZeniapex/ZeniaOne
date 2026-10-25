from __future__ import annotations

import base64
import audioop
import hmac
import json
import os
import shutil
import secrets
import subprocess
import tempfile
import uuid
import wave
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
DATA = ROOT / "data"
VOICES = DATA / "voices"
OUTPUTS = DATA / "outputs"
CACHE = DATA / "model-cache"
for folder in (VOICES, OUTPUTS, CACHE):
    folder.mkdir(parents=True, exist_ok=True)

# Keep downloaded model files with the project. This also avoids Windows Store
# and managed-environment permission problems in the default user cache.
os.environ.setdefault("HF_HOME", str(CACHE / "huggingface"))
os.environ.setdefault("TORCH_HOME", str(CACHE / "torch"))

app = FastAPI(title="EchoSelf", version="1.0.0")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")

_whisper = None
_tts = None
_tts_voice_signature = None

SARVAM_BASE_URL = "https://api.sarvam.ai"
SARVAM_VOICE_FILE = DATA / "sarvam-voice.json"
EXOTEL_TOKEN_FILE = DATA / "exotel-stream-token.txt"


def sarvam_key() -> str:
    return os.getenv("SARVAM_API_KEY", "").strip()


def exotel_stream_token() -> str:
    configured = os.getenv("EXOTEL_STREAM_TOKEN", "").strip()
    if configured:
        return configured
    if EXOTEL_TOKEN_FILE.exists():
        return EXOTEL_TOKEN_FILE.read_text(encoding="utf-8").strip()
    generated = secrets.token_urlsafe(32)
    EXOTEL_TOKEN_FILE.write_text(generated, encoding="utf-8")
    return generated


def provider() -> str:
    configured = os.getenv("VOICE_PROVIDER", "auto").lower()
    return "sarvam" if configured == "sarvam" or (configured == "auto" and sarvam_key()) else "local"


def language_code(language: str) -> str:
    codes = {
        "en": "en-IN",
        "en-IN": "en-IN",
        "hi": "hi-IN",
        "hi-IN": "hi-IN",
        "gu": "gu-IN",
        "gu-IN": "gu-IN",
    }
    return codes.get(language, "en-IN")


def read_sarvam_voice_id() -> str | None:
    try:
        return json.loads(SARVAM_VOICE_FILE.read_text(encoding="utf-8"))["voice_id"]
    except (FileNotFoundError, KeyError, json.JSONDecodeError):
        return None


def sarvam_error(response: httpx.Response, action: str) -> HTTPException:
    try:
        detail = response.json().get("detail") or response.json().get("message") or response.text
    except (ValueError, AttributeError):
        detail = response.text
    return HTTPException(response.status_code, f"Sarvam {action} failed: {detail[:400]}")


def prepare_sarvam_reference(source: Path) -> Path:
    """Create the short, mono WAV reference expected by Sarvam cloning."""
    output = VOICES / "sarvam-reference.wav"
    ffmpeg = os.getenv("FFMPEG_PATH") or shutil.which("ffmpeg")
    if not ffmpeg:
        # Sarvam accepts the original formats too. This fallback keeps uploads
        # working, but setting FFMPEG_PATH enables automatic trimming.
        return source
    command = [
        ffmpeg,
        "-y",
        "-i",
        str(source),
        "-af",
        "silenceremove=start_periods=1:start_silence=0.15:start_threshold=-45dB,atrim=duration=15",
        "-ar",
        "24000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        str(output),
    ]
    completed = subprocess.run(command, capture_output=True, text=True, timeout=60)
    if completed.returncode != 0 or not output.exists():
        raise HTTPException(422, "The recording could not be prepared. Try a clean 10–15 second WAV or MP3 sample.")
    return output


class TextQuestion(BaseModel):
    question: str
    language: str = "auto"


def safe_suffix(upload: UploadFile, fallback: str = ".webm") -> str:
    suffix = Path(upload.filename or "").suffix.lower()
    return suffix if suffix in {".wav", ".mp3", ".m4a", ".ogg", ".webm", ".flac"} else fallback


async def save_upload(upload: UploadFile, destination: Path) -> None:
    content = await upload.read()
    if not content:
        raise HTTPException(400, "The recording was empty.")
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(413, "Audio must be smaller than 25 MB.")
    destination.write_bytes(content)


def transcribe_local(path: Path, requested_language: str = "auto") -> tuple[str, str]:
    global _whisper
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise HTTPException(503, "Speech recognition is not installed. Run: pip install -r requirements-ai.txt") from exc
    if _whisper is None:
        model_name = os.getenv("WHISPER_MODEL", "base")
        _whisper = WhisperModel(model_name, device="auto", compute_type="int8")
    language = None if requested_language == "auto" else requested_language
    segments, info = _whisper.transcribe(str(path), vad_filter=True, language=language)
    text = " ".join(segment.text.strip() for segment in segments).strip()
    if not text:
        raise HTTPException(422, "I couldn't hear any speech. Please try again closer to the microphone.")
    return text, language or info.language or detect_language(text)


async def transcribe_sarvam(path: Path, requested_language: str = "auto") -> tuple[str, str]:
    key = sarvam_key()
    if not key:
        raise HTTPException(503, "Add SARVAM_API_KEY to the .env file, then restart the server.")
    data = {"model": "saaras:v4", "mode": "transcribe"}
    if requested_language != "auto":
        data["language_code"] = language_code(requested_language)
    async with httpx.AsyncClient(timeout=120) as client:
        with path.open("rb") as audio_file:
            response = await client.post(
                f"{SARVAM_BASE_URL}/speech-to-text",
                headers={"api-subscription-key": key},
                data=data,
                files={"file": (path.name, audio_file, "application/octet-stream")},
            )
    if not response.is_success:
        raise sarvam_error(response, "speech recognition")
    result = response.json()
    text = result.get("transcript", "").strip()
    if not text:
        raise HTTPException(422, "Sarvam couldn't hear any speech. Please try again.")
    detected = requested_language if requested_language != "auto" else result.get("language_code", "en-IN").split("-")[0]
    return text, detected


def detect_language(text: str) -> str:
    if any("\u0a80" <= char <= "\u0aff" for char in text):
        return "gu"
    if any("\u0900" <= char <= "\u097f" for char in text):
        return "hi"
    return "en"


async def answer_question(question: str, language: str = "auto") -> str:
    base_url = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    language_instruction = {
        "en": "Answer in natural English.",
        "hi": "Answer in natural Hindi using Devanagari script.",
        "gu": "Answer in natural Gujarati using Gujarati script.",
    }.get(language, "Reply in the same language and script as the user's question.")
    prompt = (
        "You are a warm, concise voice assistant. Give a natural spoken answer with no markdown, "
        f"usually under 80 words. {language_instruction} "
        "Never claim to be the person whose voice is being used."
    )
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{base_url}/api/chat",
                json={
                    "model": model,
                    "stream": False,
                    "messages": [
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": question},
                    ],
                },
            )
            response.raise_for_status()
            return response.json()["message"]["content"].strip()
    except (httpx.HTTPError, KeyError) as exc:
        raise HTTPException(503, f"Ollama is unavailable. Start Ollama and run: ollama pull {model}") from exc


def synthesize_local(text: str, voice_path: Path, output_path: Path, language: str = "auto") -> None:
    global _tts, _tts_voice_signature
    try:
        import torch
        import torchaudio as ta
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    except ImportError as exc:
        raise HTTPException(503, "Voice cloning is not installed. Run: pip install -r requirements-ai.txt") from exc
    if _tts is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _tts = ChatterboxMultilingualTTS.from_pretrained(device=device)
        _tts_voice_signature = None

    # Speaker conditioning is the expensive "voice analysis" step. Cache it
    # until the reference recording changes instead of recomputing it for every
    # reply. The model remains resident in memory for the life of the server.
    stat = voice_path.stat()
    voice_signature = (str(voice_path.resolve()), stat.st_size, stat.st_mtime_ns)
    if _tts_voice_signature != voice_signature:
        _tts.prepare_conditionals(str(voice_path), exaggeration=0.35)
        _tts_voice_signature = voice_signature

    language_id = detect_language(text) if language == "auto" else language
    wav = _tts.generate(
        text,
        language_id=language_id,
        audio_prompt_path=None,
        exaggeration=0.35,
        cfg_weight=0.5,
        temperature=0.7,
    )
    ta.save(str(output_path), wav, _tts.sr)


async def synthesize_sarvam(text: str, output_path: Path, language: str = "auto") -> None:
    key = sarvam_key()
    voice_id = read_sarvam_voice_id()
    if not key:
        raise HTTPException(503, "Add SARVAM_API_KEY to the .env file, then restart the server.")
    if not voice_id:
        raise HTTPException(400, "Upload the voice sample again so Sarvam can create the clone.")
    output_language = detect_language(text) if language == "auto" else language
    async with httpx.AsyncClient(timeout=180) as client:
        response = await client.post(
            f"{SARVAM_BASE_URL}/voices/clone",
            headers={"api-subscription-key": key},
            data={
                "voice_id": voice_id,
                "text": text[:1000],
                "language_code": language_code(output_language),
            },
        )
    if not response.is_success:
        raise sarvam_error(response, "voice generation")
    try:
        output_path.write_bytes(base64.b64decode(response.json()["audio"]))
    except (KeyError, ValueError) as exc:
        raise HTTPException(502, "Sarvam returned an invalid audio response.") from exc


async def synthesize(text: str, voice_path: Path, output_path: Path, language: str = "auto") -> None:
    if provider() == "sarvam":
        await synthesize_sarvam(text, output_path, language)
    else:
        synthesize_local(text, voice_path, output_path, language)


def pcm_to_wav(pcm: bytes, output_path: Path, sample_rate: int = 8000) -> None:
    import wave

    with wave.open(str(output_path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm)


def audio_to_exotel_pcm(source: Path, sample_rate: int = 8000) -> bytes:
    ffmpeg = os.getenv("FFMPEG_PATH") or shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("FFmpeg is required for Exotel call audio.")
    completed = subprocess.run(
        [ffmpeg, "-v", "error", "-i", str(source), "-f", "s16le", "-ar", str(sample_rate), "-ac", "1", "pipe:1"],
        capture_output=True,
        timeout=60,
    )
    if completed.returncode != 0:
        raise RuntimeError("Could not convert the reply to Exotel PCM audio.")
    return completed.stdout


async def handle_call_turn(websocket: WebSocket, stream_sid: str, pcm: bytes, sample_rate: int, language: str) -> None:
    turn_id = uuid.uuid4().hex
    input_path = Path(tempfile.gettempdir()) / f"echoself-call-{turn_id}.wav"
    output_path = OUTPUTS / f"reply-call-{turn_id}.wav"
    try:
        pcm_to_wav(pcm, input_path, sample_rate)
        question, detected_language = await transcribe_sarvam(input_path, language)
        answer = await answer_question(question, detected_language)
        await synthesize_sarvam(answer, output_path, detected_language)
        reply_pcm = audio_to_exotel_pcm(output_path, sample_rate)
        # Exotel requires chunks that are multiples of 320 bytes.
        chunk_size = 3200
        for offset in range(0, len(reply_pcm), chunk_size):
            chunk = reply_pcm[offset : offset + chunk_size]
            if len(chunk) % 320:
                chunk += b"\x00" * (320 - len(chunk) % 320)
            await websocket.send_json({
                "event": "media",
                "stream_sid": stream_sid,
                "media": {"payload": base64.b64encode(chunk).decode("ascii")},
            })
        await websocket.send_json({
            "event": "mark",
            "stream_sid": stream_sid,
            "mark": {"name": f"reply-{turn_id}"},
        })
    finally:
        input_path.unlink(missing_ok=True)


@app.websocket("/exotel/media")
async def exotel_media(websocket: WebSocket) -> None:
    """Turn-based bidirectional voice agent for Exotel's Voicebot applet."""
    expected_token = exotel_stream_token()
    supplied_token = websocket.query_params.get("token", "")
    if not hmac.compare_digest(expected_token, supplied_token):
        await websocket.close(code=1008, reason="Invalid stream token")
        return
    await websocket.accept()
    stream_sid = ""
    sample_rate = 8000
    language = websocket.query_params.get("language", "auto")
    speech = bytearray()
    speaking = False
    silent_chunks = 0
    try:
        while True:
            event = await websocket.receive_json()
            event_type = event.get("event")
            if event_type == "start":
                start = event.get("start", {})
                stream_sid = start.get("stream_sid") or event.get("stream_sid", "")
                sample_rate = int(start.get("media_format", {}).get("sample_rate", 8000))
            elif event_type == "media" and stream_sid:
                chunk = base64.b64decode(event.get("media", {}).get("payload", ""))
                if not chunk:
                    continue
                level = audioop.rms(chunk, 2)
                if level >= int(os.getenv("EXOTEL_VAD_THRESHOLD", "350")):
                    speaking = True
                    silent_chunks = 0
                    speech.extend(chunk)
                elif speaking:
                    speech.extend(chunk)
                    silent_chunks += 1

                duration = len(speech) / (sample_rate * 2)
                if speaking and (silent_chunks >= 8 or duration >= 25):
                    if duration >= 0.8:
                        await handle_call_turn(websocket, stream_sid, bytes(speech), sample_rate, language)
                    speech.clear()
                    speaking = False
                    silent_chunks = 0
            elif event_type == "stop":
                break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        if stream_sid:
            await websocket.send_json({
                "event": "mark",
                "stream_sid": stream_sid,
                "mark": {"name": f"error-{type(exc).__name__}"},
            })


@app.get("/")
def home() -> FileResponse:
    return FileResponse(ROOT / "static" / "index.html")


@app.get("/api/status")
async def status() -> dict:
    ollama = False
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            ollama = (await client.get(os.getenv("OLLAMA_URL", "http://localhost:11434") + "/api/tags")).is_success
    except httpx.HTTPError:
        pass
    active_provider = provider()
    return {
        "ollama": ollama,
        "provider": active_provider,
        "sarvam_configured": bool(sarvam_key()),
        "voice_saved": bool(read_sarvam_voice_id()) if active_provider == "sarvam" else any(VOICES.iterdir()),
    }


@app.post("/api/voice")
async def store_voice(
    consent: bool = Form(...),
    language: str = Form("en"),
    audio: UploadFile = File(...),
) -> dict:
    if not consent:
        raise HTTPException(400, "Confirm that this is your voice or that you have permission to use it.")
    for old in VOICES.iterdir():
        if old.is_file():
            old.unlink()
    path = VOICES / f"reference{safe_suffix(audio)}"
    await save_upload(audio, path)
    if provider() == "sarvam":
        key = sarvam_key()
        if not key:
            raise HTTPException(503, "Add SARVAM_API_KEY to the .env file, then restart the server.")
        # A newly submitted recording must always create a fresh Sarvam clone.
        # Reusing the saved ID here would keep speaking with the previous voice.
        async with httpx.AsyncClient(timeout=180) as client:
            sarvam_reference = prepare_sarvam_reference(path)
            with sarvam_reference.open("rb") as audio_file:
                response = await client.post(
                    f"{SARVAM_BASE_URL}/voices/create",
                    headers={"api-subscription-key": key},
                    data={
                        "name": f"EchoSelf Voice {uuid.uuid4().hex[:6]}",
                        "language": language_code(language),
                        "style": "conversational",
                    },
                    files={"file": (sarvam_reference.name, audio_file, "audio/wav" if sarvam_reference.suffix == ".wav" else audio.content_type or "application/octet-stream")},
                )
        if not response.is_success:
            raise sarvam_error(response, "voice creation")
        result = response.json().get("data", {})
        new_voice_id = result.get("voice_id")
        if not new_voice_id:
            raise HTTPException(502, "Sarvam did not return a voice ID.")
        SARVAM_VOICE_FILE.write_text(
            json.dumps({"voice_id": new_voice_id, "reference_text": result.get("reference_text", "")}, indent=2),
            encoding="utf-8",
        )
        return {"ok": True, "message": "New Sarvam voice is ready.", "provider": "sarvam"}
    return {"ok": True, "message": "Voice sample saved on this device.", "provider": "local", "filename": path.name}


def current_voice() -> Path:
    voice = next((p for p in VOICES.iterdir() if p.is_file()), None)
    if not voice:
        raise HTTPException(400, "Add a voice sample first.")
    return voice


@app.post("/api/ask-audio")
async def ask_audio(audio: UploadFile = File(...), language: str = Form("auto")) -> dict:
    voice = current_voice()
    question_path = Path(tempfile.gettempdir()) / f"echoself-{uuid.uuid4().hex}{safe_suffix(audio)}"
    try:
        await save_upload(audio, question_path)
        if provider() == "sarvam":
            question, detected_language = await transcribe_sarvam(question_path, language)
        else:
            question, detected_language = transcribe_local(question_path, language)
        answer = await answer_question(question, detected_language)
        output_name = f"reply-{uuid.uuid4().hex}.wav"
        await synthesize(answer, voice, OUTPUTS / output_name, detected_language)
        return {"question": question, "answer": answer, "language": detected_language, "audio_url": f"/api/audio/{output_name}"}
    finally:
        question_path.unlink(missing_ok=True)


@app.post("/api/ask-text")
async def ask_text(payload: TextQuestion) -> dict:
    voice = current_voice()
    question = payload.question.strip()
    if not question:
        raise HTTPException(400, "Type a question first.")
    language = detect_language(question) if payload.language == "auto" else payload.language
    answer = await answer_question(question, language)
    output_name = f"reply-{uuid.uuid4().hex}.wav"
    await synthesize(answer, voice, OUTPUTS / output_name, language)
    return {"question": question, "answer": answer, "language": language, "audio_url": f"/api/audio/{output_name}"}


@app.get("/api/audio/{filename}")
def audio(filename: str) -> FileResponse:
    if not filename.startswith("reply-") or Path(filename).name != filename:
        raise HTTPException(404)
    path = OUTPUTS / filename
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type="audio/wav", filename=filename)
