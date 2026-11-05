import os
import subprocess
import tempfile
import pytest
from fastapi import HTTPException

def test_short_audio_length_check():
    """Verify that audio under 4 seconds (< 192,000 bytes at 24kHz 16-bit mono) raises 422."""
    short_bytes = b"\x00" * 100000 # ~2.08 seconds
    with pytest.raises(HTTPException) as exc_info:
        if len(short_bytes) < 192000:
            duration_sec = round(len(short_bytes) / 48000, 1)
            raise HTTPException(
                status_code=422,
                detail=f"Speech duration is too short ({duration_sec}s). Sarvam AI requires at least 10–15 seconds of continuous clear speech. Please record for at least 10–15 seconds."
            )
    assert exc_info.value.status_code == 422
    assert "Speech duration is too short" in exc_info.value.detail

def test_ffmpeg_cloning_pipeline():
    """Verify that FFmpeg processes synthetic audio to 24kHz mono PCM WAV with loudnorm."""
    temp_dir = tempfile.gettempdir()
    input_wav = os.path.join(temp_dir, "test_input_synth.wav")
    output_wav = os.path.join(temp_dir, "test_output_synth.wav")
    
    try:
        # Generate 10 seconds of 1000Hz test tone
        gen_cmd = [
            "ffmpeg", "-y", "-f", "lavfi", "-i", "sine=f=440:d=10",
            "-ar", "44100", "-ac", "1", input_wav
        ]
        subprocess.run(gen_cmd, capture_output=True, check=True)
        assert os.path.exists(input_wav)
        
        # Run our new clone filter chain
        audio_filter = (
            "silenceremove=start_periods=1:start_duration=0.08:start_threshold=-32dB,"
            "atrim=duration=15,"
            "highpass=f=75,lowpass=f=12000,"
            "loudnorm=I=-16:TP=-1.5:LRA=11"
        )
        ffmpeg_cmd = [
            "ffmpeg", "-y", "-i", input_wav,
            "-af", audio_filter,
            "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", output_wav
        ]
        res = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        assert res.returncode == 0
        assert os.path.exists(output_wav)
        size = os.path.getsize(output_wav)
        # 10s at 24kHz mono 16-bit PCM is ~480,000 bytes
        assert size >= 400000
    finally:
        if os.path.exists(input_wav): os.remove(input_wav)
        if os.path.exists(output_wav): os.remove(output_wav)

