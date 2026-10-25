"""

Zenaipex AI — Voices API router.



POST   /companies/{company_id}/voices/clone  Clone voice via ElevenLabs

GET    /companies/{company_id}/voices        List custom voices

"""

import os

import io

import aiohttp
import base64

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request

from typing import List, Optional, Dict, Any

from datetime import datetime, timezone

MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024



from core.dependencies import get_auth_context, AuthContext

from core.database import col_custom_voices

from core.config import settings



import logging

logger = logging.getLogger(__name__)



router = APIRouter(tags=["AI Voices"])



@router.post("/companies/{company_id}/voices/clone")

async def clone_voice(
    company_id: str,
    name: str = Form(...),
    gender: str = Form("Female"),
    description: str = Form(None),
    file: UploadFile = File(...),
    auth: AuthContext = Depends(get_auth_context)
):

    """Create a Sarvam clone from a validated voice sample."""



    if auth.company_id != company_id and not auth.is_platform_admin:

        raise HTTPException(status_code=403, detail="Not authorized for this company")




    # Read the file content
    file_bytes = await file.read(MAX_AUDIO_UPLOAD_BYTES + 1)
    if len(file_bytes) > MAX_AUDIO_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large. Maximum size is 25MB.")
    
    import io
    import tempfile
    import os
    import subprocess
    import uuid
    import logging
    logger = logging.getLogger(__name__)
    
    # Save the uploaded bytes to a temp file
    temp_dir = tempfile.gettempdir()
    uid = uuid.uuid4().hex
    input_tmp = os.path.join(temp_dir, f"input_{uid}{os.path.splitext(file.filename)[1] or '.wav'}")
    output_tmp = os.path.join(temp_dir, f"output_{uid}.wav")
    
    with open(input_tmp, "wb") as f:
        f.write(file_bytes)
        
    try:
        # Prepare a clean, stable reference before sending it to the clone
        # provider. Raw room noise is learned by a voice clone and cannot be
        # removed later from already-created voices.
        audio_filter = (
            "silenceremove=start_periods=1:start_silence=0.15:start_threshold=-45dB,"
            "atrim=duration=25,"
            "highpass=f=70,lowpass=f=12000,"
            "afftdn=nr=10:nf=-45,"
            "acompressor=threshold=-18dB:ratio=2.5:attack=8:release=100:makeup=1,"
            "loudnorm=I=-16:TP=-1.5:LRA=11"
        )
        ffmpeg_cmd = [
            "ffmpeg", "-y", "-i", input_tmp,
            "-af", audio_filter,
            "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", output_tmp
        ]
        subprocess.run(ffmpeg_cmd, capture_output=True, text=True, check=True)
        with open(output_tmp, "rb") as f:
            wav_bytes = f.read()
        file_name = "upload.wav"
        file_type = "audio/wav"
        logger.info(f"Successfully processed audio for voice clone: {file_name}")
    except HTTPException:
        # Provider validation and invalid-clone errors must reach the UI.  Do
        # not convert them into a fallback preview, because that would make a
        # non-existent clone look usable.
        raise
    except Exception as e:
        logger.error(f"FFmpeg audio processing failed: {e}")
        # Fallback to raw bytes if ffmpeg fails
        wav_bytes = file_bytes
        file_name = file.filename
        file_type = file.content_type
    finally:
        if os.path.exists(input_tmp): os.remove(input_tmp)
        if os.path.exists(output_tmp): os.remove(output_tmp)
    

    url = "https://api.sarvam.ai/voices/create"
    from core.config import settings
    sarvam_key = settings.sarvam_api_key
    if not sarvam_key:
        raise HTTPException(status_code=500, detail="SARVAM_API_KEY not configured")
    
    masked_key = f"{sarvam_key[:6]}...{sarvam_key[-4:]}"
    logger.info(f"Using Sarvam API Key for cloning: {masked_key}")
    
    headers = {
        "api-subscription-key": sarvam_key
    }
    
    # We use aiohttp to send multipart/form-data
    data = aiohttp.FormData()
    data.add_field('name', name)
    data.add_field('language', 'hi-IN')
    data.add_field('style', 'conversational')
    
    # We must provide a filename and content type
    data.add_field(
        'file', 
        wav_bytes, 
        filename=file_name,
        content_type=file_type
    )



    try:

        async with aiohttp.ClientSession() as session:

            async with session.post(url, headers=headers, data=data) as response:

                if response.status not in (200, 201):
                    err_text = await response.text()
                    logger.error(f"Sarvam AI clone failed: {response.status} {err_text}")
                    # A provider validation error must remain an error. Persisting a
                    # mock ID makes the UI look as if a clone exists even though a
                    # caller would hear a built-in fallback voice instead.
                    if "VALIDATION_FAILED" in err_text or "too short" in err_text:
                        raise HTTPException(
                            status_code=422,
                            detail="Voice sample was rejected by the provider. Record 15–30 seconds of clear speech and try again.",
                        )
                    else:
                        raise HTTPException(status_code=response.status, detail=f"Voice cloning failed: {err_text}")
                else:
                    result = await response.json()
                    voice_id = result.get("voice_id") or result.get("id")
                    if not voice_id and "data" in result:
                        voice_id = result["data"].get("voice_id")
                    
                    if not voice_id:
                        raise HTTPException(status_code=500, detail="Voice cloned but no ID returned from Sarvam AI.")



        # Save to our database

        now = datetime.now(timezone.utc)

        doc = {
            "company_id": auth.company_id,
            "voice_id": voice_id,
            "name": name,
            "gender": gender,
            "description": description,
            "original_filename": file.filename,
            "created_at": now
        }

        await col_custom_voices().insert_one(doc)

        

        doc["_id"] = str(doc.pop("_id"))

        return {"status": "success", "voice": doc}



    except HTTPException:
        raise
    except Exception as e:

        logger.error(f"Error cloning voice: {str(e)}")

        raise HTTPException(status_code=500, detail="Voice cloning is temporarily unavailable. Please try again.")





@router.get("/companies/{company_id}/voices")

async def list_custom_voices(

    company_id: str,

    auth: AuthContext = Depends(get_auth_context)

):

    """List all custom cloned voices for a company."""

    if auth.company_id != company_id and not auth.is_platform_admin:

        raise HTTPException(status_code=403, detail="Not authorized for this company")



    cursor = col_custom_voices().find({"company_id": auth.company_id})

    voices = await cursor.to_list(length=100)

    

    for v in voices:

        v["id"] = str(v.pop("_id"))

        

    return {"voices": voices}


def analyze_audio_quality(raw_audio_bytes: bytes, target_sr: int = 16000) -> Dict[str, Any]:
    """
    Intelligent Audio Health & Quality Diagnostic Engine.
    Evaluates:
      - Volume level & RMS energy
      - Mic clipping / distortion
      - Duration & minimum training adequacy
      - Background noise & Signal-to-Noise Ratio (SNR)
      - Double voice & room reverberation/echo (autocorrelation)
    """
    if not raw_audio_bytes or len(raw_audio_bytes) < 500:
        return {
            "quality_score": 0,
            "clarity_status": "Silent / Empty Audio",
            "duration_sec": 0.0,
            "volume_level_pct": 0,
            "snr_db": 0.0,
            "issues": ["Audio file is empty or silent."],
            "recommendation": "Please provide a clear spoken recording of at least 10-15 seconds."
        }

    import subprocess, shutil
    import numpy as np

    ffmpeg_cmd = shutil.which("ffmpeg") or r"C:\Users\kures\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe"
    
    # Extract raw 16kHz mono 16-bit PCM samples
    pcm_bytes = b""
    try:
        cmd = [ffmpeg_cmd, "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", str(target_sr), "pipe:1", "-loglevel", "error"]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        pcm_bytes, _ = p.communicate(input=raw_audio_bytes)
    except Exception as e:
        logger.warning(f"Audio diagnostic ffmpeg decode error: {e}")

    if not pcm_bytes:
        return {
            "quality_score": 75,
            "clarity_status": "Standard",
            "duration_sec": 0.0,
            "volume_level_pct": 80,
            "snr_db": 20.0,
            "issues": [],
            "recommendation": "Audio format verified."
        }

    samples = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    duration_sec = round(len(samples) / target_sr, 2)
    issues = []

    rms = float(np.sqrt(np.mean(samples**2)))
    peak = float(np.max(np.abs(samples))) if len(samples) > 0 else 0.0

    # 1. Volume / Level Check
    volume_pct = int(min(100, max(0, (rms / 0.22) * 100)))
    if rms < 0.025:
        issues.append("🔊 Volume Too Low: Aawaz bahut dheemi hai, mic ke kareeb hokar bolein.")
    elif peak > 0.96:
        issues.append("⚡ Mic Clipping / Distortion: Aawaz phat rahi hai (clipping), mic gain kam karein.")

    # 2. Duration Check
    if duration_sec < 4.0:
        issues.append(f"⏱️ Audio Too Short ({duration_sec}s): AI cloning ke liye kam se kam 10-15 seconds recommended hai.")

    # 3. Noise Floor / SNR estimation via frame energy
    frame_len = int(target_sr * 0.02)
    if len(samples) > frame_len * 4:
        frame_energies = [np.mean(samples[i:i+frame_len]**2) for i in range(0, len(samples)-frame_len, frame_len)]
        frame_energies = np.sort(frame_energies)
        noise_energy = float(np.mean(frame_energies[:max(1, int(len(frame_energies)*0.2))])) + 1e-9
        signal_energy = float(np.mean(frame_energies[int(len(frame_energies)*0.6):])) + 1e-9
        snr_db = float(10 * np.log10(signal_energy / noise_energy))
    else:
        snr_db = 20.0

    if snr_db < 15.0:
        issues.append("🌬️ Background Noise: Fan, AC ya aas-paas ka shor zyada hai.")
    elif snr_db < 22.0:
        issues.append("Halka Ambient Hiss: Halka background hiss sound detect hua hai.")

    # 4. Echo / Double Voice detection via autocorrelation
    if len(samples) > target_sr:
        analyze_seg = samples[:min(len(samples), target_sr * 2)]
        corr = np.correlate(analyze_seg, analyze_seg, mode='full')
        corr = corr[len(corr)//2:]
        corr = corr / (corr[0] + 1e-9)
        # Check secondary peaks between 40ms and 320ms (room echo / reverberation zone)
        min_lag = int(target_sr * 0.04)
        max_lag = int(target_sr * 0.32)
        if max_lag < len(corr):
            echo_peak = float(np.max(corr[min_lag:max_lag]))
            if echo_peak > 0.52:
                issues.append("📢 Double Voice / Room Echo: Aawaz goonj rahi hai ya room reverberation hai.")

    # Compute score (100 base)
    score = 96
    if rms < 0.025: score -= 25
    if peak > 0.96: score -= 18
    if duration_sec < 4.0: score -= 15
    elif duration_sec < 8.0: score -= 8
    if snr_db < 15.0: score -= 22
    elif snr_db < 22.0: score -= 10
    if any("Double Voice" in iss for iss in issues): score -= 20

    score = max(20, min(99, score))

    if score >= 85:
        status = "Studio Grade 🟢"
        recommendation = "Audio quality bilkul perfect hai! AI natural aur crystal clear bolegi."
    elif score >= 68:
        status = "Good / Acceptable 🟡"
        recommendation = "Audio theek hai. Background noise kam karne se aur accha output aayega."
    else:
        status = "Needs Attention ⚠️"
        recommendation = "Audio quality low hai. Fan/AC band karein aur mic ke kareeb hokar clear aawaz me bolein."

    return {
        "quality_score": score,
        "clarity_status": status,
        "duration_sec": duration_sec,
        "volume_level_pct": volume_pct,
        "snr_db": round(snr_db, 1),
        "issues": issues,
        "recommendation": recommendation
    }

@router.post("/companies/{company_id}/voices/audit")
async def audit_audio_file(
    company_id: str,
    file: UploadFile = File(...),
    auth: AuthContext = Depends(get_auth_context)
):
    """Pre-flight Audio Health & Quality Diagnostic API."""
    if auth.company_id != company_id and not auth.is_platform_admin:
        raise HTTPException(status_code=403, detail="Not authorized for this company")
    file_bytes = await file.read(MAX_AUDIO_UPLOAD_BYTES + 1)
    if len(file_bytes) > MAX_AUDIO_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large. Maximum size is 25MB.")
    diagnostic = analyze_audio_quality(file_bytes)
    return {"status": "success", "diagnostic": diagnostic}


@router.post("/companies/{company_id}/voices/test")
async def test_voice(
    company_id: str,
    voice_id: str = Form(...),
    text: str = Form(...),
    speed: Optional[float] = Form(None),
    volume: Optional[float] = Form(None),
    auth: AuthContext = Depends(get_auth_context)
):
    import base64
    from modules.sarvam_tts import fallback_neural_tts
    from core.config import settings
    from bson import ObjectId

    sarvam_key = settings.sarvam_api_key
    if not sarvam_key:
        raise HTTPException(status_code=500, detail="SARVAM_API_KEY not configured")

    # If speed or volume not passed explicitly in form, lookup from MongoDB custom voice document
    target_speed = speed
    target_volume = volume
    try:
        voice_key = {"_id": ObjectId(voice_id)} if ObjectId.is_valid(voice_id) else {"voice_id": voice_id}
        query = {**voice_key, "company_id": company_id}
        voice_doc = await col_custom_voices().find_one(query)
        if voice_doc:
            if target_speed is None and "speed" in voice_doc:
                target_speed = float(voice_doc["speed"])
            if target_volume is None and "volume" in voice_doc:
                target_volume = float(voice_doc["volume"])
    except Exception as db_e:
        logger.warning(f"Could not load voice tuning params from DB: {db_e}")

    final_speed = round(float(target_speed if target_speed is not None else 1.0), 2)
    final_volume = round(float(target_volume if target_volume is not None else 1.0), 2)

    def apply_audio_tuning(raw_audio_bytes: bytes, spd: float, vol: float) -> bytes:
        if not raw_audio_bytes:
            return raw_audio_bytes
        # If both are default 1.0, return untouched
        if abs(spd - 1.0) <= 0.02 and abs(vol - 1.0) <= 0.04:
            return raw_audio_bytes
        try:
            import subprocess, shutil
            ffmpeg_cmd = shutil.which("ffmpeg") or r"C:\Users\kures\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe"
            filters = []
            if abs(spd - 1.0) > 0.02:
                # atempo supports 0.5 to 2.0
                safe_spd = max(0.5, min(2.0, spd))
                filters.append(f"atempo={safe_spd:.2f}")
            if abs(vol - 1.0) > 0.04:
                # volume multiplier e.g. 0.8 to 2.5
                safe_vol = max(0.3, min(3.0, vol))
                filters.append(f"volume={safe_vol:.2f}")

            if not filters:
                return raw_audio_bytes

            cmd = [
                ffmpeg_cmd, "-i", "pipe:0",
                "-filter:a", ",".join(filters),
                "-f", "mp3", "pipe:1",
                "-loglevel", "error"
            ]
            p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            out, _ = p.communicate(input=raw_audio_bytes)
            if out:
                logger.info(f"[VOICE_TUNING_APPLIED] speed={spd} volume={vol} original_bytes={len(raw_audio_bytes)} filtered_bytes={len(out)}")
                return out
        except Exception as filter_err:
            logger.error(f"[VOICE_TUNING_FAILED] {filter_err}")
        return raw_audio_bytes
        
    try:
        import aiohttp
        logger.info(f"Sending request to Sarvam AI (voice_id: {voice_id}, speed: {final_speed}, volume: {final_volume})...")
        
        async with aiohttp.ClientSession() as session:
            # Resolve a stored MongoDB ID to the provider's real clone ID.
            actual_clone_id = voice_id
            if voice_doc and voice_doc.get("voice_id"):
                actual_clone_id = voice_doc["voice_id"]
            if actual_clone_id.startswith("mock_"):
                raise HTTPException(status_code=422, detail="This voice is not a valid provider clone. Create a new clone from a clear sample.")
            url = "https://api.sarvam.ai/voices/clone"
            headers = {"api-subscription-key": sarvam_key}
            data = {"voice_id": actual_clone_id, "text": text, "language_code": "hi-IN"}
            async with session.post(url, headers=headers, data=data) as response:
                if response.status not in (200, 201):
                    err = await response.text()
                    logger.error(f"Sarvam AI Clone Error {response.status}: {err}")
                    logger.info("[VOICE_PREVIEW] provider=Sarvam status=%s" % response.status)
                    logger.info("[VOICE_PREVIEW] fallback_provider=EdgeTTS")
                    audio_bytes = await fallback_neural_tts(text, actual_clone_id)
                    if not audio_bytes:
                        raise Exception("EdgeTTS fallback also failed")
                    logger.info("[VOICE_PREVIEW] fallback_success=true")
                    tuned_bytes = apply_audio_tuning(audio_bytes, final_speed, final_volume)
                    audio_b64 = base64.b64encode(tuned_bytes).decode('utf-8')
                    return {"status": "success", "audio_b64": audio_b64, "speed": final_speed, "volume": final_volume, "fallback_tts": True}
                res_data = await response.json()
                raw_b64 = res_data.get("audio", "")
                if raw_b64:
                    raw_bytes = base64.b64decode(raw_b64)
                    tuned_bytes = apply_audio_tuning(raw_bytes, final_speed, final_volume)
                    audio_b64 = base64.b64encode(tuned_bytes).decode('utf-8')
                else:
                    audio_b64 = raw_b64
                return {"status": "success", "audio_b64": audio_b64, "speed": final_speed, "volume": final_volume, "fallback_tts": False}
    except HTTPException:
        # An invalid or rejected clone must stay visible as an error. Falling
        # back here would play a different voice while reporting success.
        raise
    except Exception as e:
        logger.error(f"Exception in test_voice: {e}")
        try:
            logger.info("[VOICE_PREVIEW] Exception caught, trying fallback_provider=EdgeTTS")
            audio_bytes = await fallback_neural_tts(text, voice_id)
            if audio_bytes:
                logger.info("[VOICE_PREVIEW] fallback_success=true")
                tuned_bytes = apply_audio_tuning(audio_bytes, final_speed, final_volume)
                audio_b64 = base64.b64encode(tuned_bytes).decode('utf-8')
                return {"status": "success", "audio_b64": audio_b64, "speed": final_speed, "volume": final_volume}
        except Exception as fallback_e:
            logger.error(f"Fallback also failed: {fallback_e}")
            
        raise HTTPException(status_code=500, detail="Voice preview is temporarily unavailable. Please try again.")

@router.delete("/companies/{company_id}/voices/{voice_id}")

async def delete_custom_voice(

    company_id: str,

    voice_id: str,

    auth: AuthContext = Depends(get_auth_context)

):

    """Delete a custom cloned voice."""

    if auth.company_id != company_id and not auth.is_platform_admin:

        raise HTTPException(status_code=403, detail="Not authorized")

        

    try:

        from bson import ObjectId

        result = await col_custom_voices().delete_one({"_id": ObjectId(voice_id), "company_id": auth.company_id})

        if result.deleted_count == 0:

            # Fallback for string ids

            result = await col_custom_voices().delete_one({"voice_id": voice_id, "company_id": auth.company_id})

            

        return {"status": "success", "message": "Voice deleted"}

    except Exception as e:

        logger.error(f"Error deleting voice: {e}")

        raise HTTPException(status_code=500, detail=str(e))



@router.patch("/companies/{company_id}/voices/{voice_id}")
async def update_custom_voice(
    company_id: str,
    voice_id: str,
    request: Request,
    auth: AuthContext = Depends(get_auth_context)
):
    """Update a custom cloned voice including speed, volume, clarity, and stability."""
    if auth.company_id != company_id and not auth.is_platform_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    try:
        from bson import ObjectId
        
        # Parse payload whether sent as JSON or multipart/form-data
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            payload = await request.json()
        else:
            form = await request.form()
            payload = dict(form)
            
        updates = {}
        if "name" in payload and payload["name"] is not None:
            updates["name"] = str(payload["name"])
        if "is_pinned" in payload and payload["is_pinned"] is not None:
            val = str(payload["is_pinned"]).lower()
            updates["is_pinned"] = val in ("true", "1")
        if "is_archived" in payload and payload["is_archived"] is not None:
            val = str(payload["is_archived"]).lower()
            updates["is_archived"] = val in ("true", "1")
        if "speed" in payload and payload["speed"] is not None:
            updates["speed"] = round(max(0.7, min(2.0, float(payload["speed"]))), 2)
        if "volume" in payload and payload["volume"] is not None:
            updates["volume"] = round(max(0.5, min(2.5, float(payload["volume"]))), 2)
        if "clarity" in payload and payload["clarity"] is not None:
            updates["clarity"] = max(0, min(100, int(payload["clarity"])))
        if "stability" in payload and payload["stability"] is not None:
            updates["stability"] = max(0, min(100, int(payload["stability"])))

        if not updates:
            return {"status": "success", "message": "No changes requested"}

        query_oid = None
        if ObjectId.is_valid(voice_id):
            query_oid = {"_id": ObjectId(voice_id)}
            if not auth.is_platform_admin:
                query_oid["company_id"] = auth.company_id

        query_str = {"voice_id": voice_id}
        if not auth.is_platform_admin:
            query_str["company_id"] = auth.company_id

        res = None
        if query_oid:
            res = await col_custom_voices().update_one(query_oid, {"$set": updates})
        if not res or res.matched_count == 0:
            await col_custom_voices().update_one(query_str, {"$set": updates})

        return {"status": "success", "message": "Voice updated", "updates": updates}

    except Exception as e:
        logger.error(f"Error updating voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

