"""
Audio Utilities for Real-time Voice Processing
Handles audio format conversion between Twilio (mu-law 8kHz) and Sarvam (PCM 16kHz).
"""
import struct
import io
import wave
from typing import Optional, Tuple
import base64

# Handle audioop deprecation in Python 3.13+
try:
    import audioop
except ImportError:
    import audioop_lts as audioop

# For MP3 decoding
from pydub import AudioSegment


# Twilio Media Streams sends mu-law encoded audio at 8kHz
TWILIO_SAMPLE_RATE = 8000
TWILIO_SAMPLE_WIDTH = 1  # 8-bit mu-law

# Sarvam expects PCM 16-bit at 16kHz
SARVAM_SAMPLE_RATE = 16000
SARVAM_SAMPLE_WIDTH = 2  # 16-bit PCM


def mp3_to_pcm(mp3_data: bytes) -> bytes:
    try:
        audio = AudioSegment.from_mp3(io.BytesIO(mp3_data))
        audio = audio.set_channels(1)
        audio = audio.set_frame_rate(8000)
        audio = audio.set_sample_width(2)
        audio = audio + 8
        return audio.raw_data
    except Exception as e:
        print(f"Error converting MP3 to PCM: {e}")
        return b""

def mp3_to_mulaw(mp3_data: bytes) -> bytes:
    """
    Convert MP3 audio to mu-law 8kHz for Twilio.
    
    Args:
        mp3_data: MP3 audio bytes
    
    Returns:
        mu-law encoded bytes at 8kHz
    """
    try:
        # Load MP3
        audio = AudioSegment.from_mp3(io.BytesIO(mp3_data))
        
        # Convert to mono, 8kHz, 16-bit PCM
        audio = audio.set_channels(1)
        audio = audio.set_frame_rate(8000)
        audio = audio.set_sample_width(2)  # 16-bit
        
        # Boost volume by 8 dB (loud but prevents distortion/clipping)
        audio = audio + 8

        
        # Get raw PCM data
        pcm_data = audio.raw_data
        
        # Convert PCM to mu-law
        mulaw_data = audioop.lin2ulaw(pcm_data, 2)
        
        return mulaw_data
    except Exception as e:
        print(f"❌ Error converting MP3 to mulaw: {e}")
        import traceback
        traceback.print_exc()
        return b""


def mulaw_to_pcm(mulaw_data: bytes) -> bytes:
    """
    Convert mu-law encoded audio to PCM 16-bit.
    
    Args:
        mulaw_data: Raw mu-law bytes (8-bit)
    
    Returns:
        PCM 16-bit bytes
    """
    try:
        # Convert mu-law to linear PCM
        pcm_data = audioop.ulaw2lin(mulaw_data, 2)  # 2 = 16-bit output
        return pcm_data
    except Exception as e:
        print(f"❌ Error converting mu-law to PCM: {e}")
        return b""


def pcm_to_mulaw(pcm_data: bytes) -> bytes:
    """
    Convert PCM 16-bit audio to mu-law.
    
    Args:
        pcm_data: PCM 16-bit bytes
    
    Returns:
        mu-law encoded bytes (8-bit)
    """
    try:
        mulaw_data = audioop.lin2ulaw(pcm_data, 2)  # 2 = 16-bit input
        return mulaw_data
    except Exception as e:
        print(f"❌ Error converting PCM to mu-law: {e}")
        return b""


def resample(audio_data: bytes, from_rate: int, to_rate: int, sample_width: int = 2) -> bytes:
    """
    Resample audio from one sample rate to another.
    
    Args:
        audio_data: Input audio bytes
        from_rate: Source sample rate
        to_rate: Target sample rate
        sample_width: Bytes per sample (1=8-bit, 2=16-bit)
    
    Returns:
        Resampled audio bytes
    """
    try:
        if from_rate == to_rate:
            return audio_data
        
        # Calculate conversion ratio
        resampled, _ = audioop.ratecv(
            audio_data,
            sample_width,
            1,  # mono
            from_rate,
            to_rate,
            None
        )
        return resampled
    except Exception as e:
        print(f"❌ Error resampling audio: {e}")
        return audio_data


def twilio_to_sarvam(mulaw_8k: bytes) -> bytes:
    """
    Convert Twilio audio format to Sarvam format.
    Twilio: mu-law 8kHz → Sarvam: PCM 16-bit 16kHz
    
    Args:
        mulaw_8k: mu-law encoded audio at 8kHz from Twilio
    
    Returns:
        PCM 16-bit audio at 16kHz for Sarvam STT
    """
    # Step 1: mu-law to PCM 16-bit (still at 8kHz)
    pcm_8k = mulaw_to_pcm(mulaw_8k)
    
    # Step 2: Resample from 8kHz to 16kHz
    pcm_16k = resample(pcm_8k, TWILIO_SAMPLE_RATE, SARVAM_SAMPLE_RATE, sample_width=2)
    
    return pcm_16k


def sarvam_to_twilio(pcm_data: bytes, input_rate: int = 8000) -> bytes:
    """
    Convert Sarvam TTS output to Twilio format.
    Sarvam TTS outputs at 8kHz when configured → mu-law 8kHz for Twilio
    
    Args:
        pcm_data: PCM audio from Sarvam TTS
        input_rate: Sample rate of input (default 8kHz as we configure TTS for this)
    
    Returns:
        mu-law encoded audio at 8kHz for Twilio playback
    """
    # If input is not 8kHz, resample first
    if input_rate != TWILIO_SAMPLE_RATE:
        pcm_data = resample(pcm_data, input_rate, TWILIO_SAMPLE_RATE, sample_width=2)
    
    # Convert PCM to mu-law
    mulaw_data = pcm_to_mulaw(pcm_data)
    
    return mulaw_data


def create_wav_header(sample_rate: int = 16000, sample_width: int = 2, channels: int = 1) -> bytes:
    """
    Create a WAV file header.
    
    Args:
        sample_rate: Audio sample rate
        sample_width: Bytes per sample
        channels: Number of audio channels
    
    Returns:
        WAV header bytes (44 bytes)
    """
    byte_rate = sample_rate * channels * sample_width
    block_align = channels * sample_width
    
    # We'll use a placeholder for data size (will be updated later)
    data_size = 0
    file_size = 36 + data_size
    
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        file_size,
        b'WAVE',
        b'fmt ',
        16,  # Subchunk1Size for PCM
        1,   # AudioFormat (1 = PCM)
        channels,
        sample_rate,
        byte_rate,
        block_align,
        sample_width * 8,  # BitsPerSample
        b'data',
        data_size
    )
    
    return header


def pcm_to_wav(pcm_data: bytes, sample_rate: int = 16000, sample_width: int = 2) -> bytes:
    """
    Convert raw PCM data to WAV format.
    
    Args:
        pcm_data: Raw PCM bytes
        sample_rate: Audio sample rate
        sample_width: Bytes per sample
    
    Returns:
        Complete WAV file bytes
    """
    buffer = io.BytesIO()
    
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data)
    
    return buffer.getvalue()


def wav_to_pcm(wav_data: bytes) -> Tuple[bytes, int, int]:
    """
    Extract PCM data from WAV file.
    
    Args:
        wav_data: WAV file bytes
    
    Returns:
        Tuple of (pcm_data, sample_rate, sample_width)
    """
    buffer = io.BytesIO(wav_data)
    
    with wave.open(buffer, 'rb') as wav_file:
        sample_rate = wav_file.getframerate()
        sample_width = wav_file.getsampwidth()
        pcm_data = wav_file.readframes(wav_file.getnframes())
    
    return pcm_data, sample_rate, sample_width


def base64_to_audio(base64_audio: str) -> bytes:
    """
    Decode base64 encoded audio.
    
    Args:
        base64_audio: Base64 encoded audio string
    
    Returns:
        Raw audio bytes
    """
    return base64.b64decode(base64_audio)


def audio_to_base64(audio_data: bytes) -> str:
    """
    Encode audio data to base64.
    
    Args:
        audio_data: Raw audio bytes
    
    Returns:
        Base64 encoded string
    """
    return base64.b64encode(audio_data).decode('utf-8')


def trim_silence(pcm_data: bytes, threshold: int = 500, sample_rate: int = 16000, 
                 padding_ms: int = 200) -> bytes:
    """
    Trim leading and trailing silence from PCM audio.
    
    This helps STT by removing long silences that may confuse the model.
    Keeps a small padding of silence around the speech for natural boundaries.
    
    Args:
        pcm_data: PCM 16-bit audio bytes
        threshold: RMS energy threshold below which is considered silence
        sample_rate: Audio sample rate
        padding_ms: Milliseconds of silence to keep as padding
        
    Returns:
        Trimmed PCM audio with padding
    """
    if len(pcm_data) < 640:  # Too short to process (20ms at 16kHz)
        return pcm_data
    
    # Window size for RMS calculation (20ms)
    window_samples = int(sample_rate * 0.02)
    window_bytes = window_samples * 2  # 16-bit
    padding_bytes = int(sample_rate * padding_ms / 1000) * 2
    
    # Find speech start
    speech_start = 0
    for i in range(0, len(pcm_data) - window_bytes, window_bytes):
        chunk = pcm_data[i:i + window_bytes]
        try:
            rms = audioop.rms(chunk, 2)
            if rms >= threshold:
                speech_start = max(0, i - padding_bytes)
                break
        except:
            pass
    
    # Find speech end (search backwards)
    speech_end = len(pcm_data)
    for i in range(len(pcm_data) - window_bytes, window_bytes, -window_bytes):
        chunk = pcm_data[i:i + window_bytes]
        try:
            rms = audioop.rms(chunk, 2)
            if rms >= threshold:
                speech_end = min(len(pcm_data), i + window_bytes + padding_bytes)
                break
        except:
            pass
    
    # Ensure we don't trim too much
    trimmed = pcm_data[speech_start:speech_end]
    
    # Ensure even number of bytes (16-bit alignment)
    if len(trimmed) % 2 != 0:
        trimmed = trimmed[:-1]
    
    # Don't return too short audio
    min_bytes = sample_rate * 2 // 4  # 250ms minimum
    if len(trimmed) < min_bytes:
        return pcm_data  # Return original if trimmed too much
    
    original_duration = len(pcm_data) / 2 / sample_rate
    trimmed_duration = len(trimmed) / 2 / sample_rate
    
    if trimmed_duration < original_duration * 0.8:  # Only log if significant trimming
        print(f"✂️ Trimmed audio: {original_duration:.1f}s → {trimmed_duration:.1f}s")
    
    return trimmed

class AudioBuffer:
    """
    Buffer for accumulating audio chunks with automatic conversion.
    Useful for collecting Twilio audio before sending to STT.
    """
    
    def __init__(self, target_duration_ms: int = 100):
        """
        Initialize audio buffer.
        
        Args:
            target_duration_ms: Target buffer duration before flush (milliseconds)
        """
        self.buffer = b""
        self.target_duration_ms = target_duration_ms
        self.sample_rate = TWILIO_SAMPLE_RATE
        self.sample_width = TWILIO_SAMPLE_WIDTH
        
    def add_chunk(self, mulaw_chunk: bytes) -> Optional[bytes]:
        """
        Add mu-law audio chunk to buffer.
        Returns converted PCM data when buffer reaches target duration.
        
        Args:
            mulaw_chunk: mu-law encoded audio from Twilio
        
        Returns:
            Converted PCM data if buffer full, else None
        """
        self.buffer += mulaw_chunk
        
        # Calculate current duration
        # mu-law is 8-bit, so 1 byte = 1 sample
        samples = len(self.buffer)
        duration_ms = (samples / self.sample_rate) * 1000
        
        if duration_ms >= self.target_duration_ms:
            # Convert and return
            pcm_data = twilio_to_sarvam(self.buffer)
            self.buffer = b""
            return pcm_data
        
        return None
    
    def flush(self) -> Optional[bytes]:
        """
        Flush remaining audio in buffer.
        
        Returns:
            Converted PCM data if buffer has content, else None
        """
        if self.buffer:
            pcm_data = twilio_to_sarvam(self.buffer)
            self.buffer = b""
            return pcm_data
        return None
    
    def clear(self):
        """Clear the buffer."""
        self.buffer = b""
    
    @property
    def duration_ms(self) -> float:
        """Current buffer duration in milliseconds."""
        samples = len(self.buffer)
        return (samples / self.sample_rate) * 1000


class SilenceDetector:
    """
    Simple Voice Activity Detection (VAD) using energy threshold.
    Detects when user stops speaking based on audio energy levels.
    
    Enhanced with minimum speech duration to avoid cutting off speech too early.
    """
    
    def __init__(
        self,
        threshold: int = 500,
        silence_duration_ms: int = 700,
        min_speech_duration_ms: int = 1500,  # Minimum speech before allowing silence detection
        sample_rate: int = SARVAM_SAMPLE_RATE  # Default to Sarvam's 16kHz
    ):
        """
        Initialize silence detector.
        
        Args:
            threshold: Energy threshold below which audio is considered silence
            silence_duration_ms: Duration of silence to trigger end-of-speech
            min_speech_duration_ms: Minimum speech duration before silence detection activates
            sample_rate: Audio sample rate (default 16kHz for PCM from twilio_to_sarvam)
        """
        self.threshold = threshold
        self.silence_duration_ms = silence_duration_ms
        self.min_speech_duration_ms = min_speech_duration_ms
        self.sample_rate = sample_rate
        self.silence_samples = 0
        self.speech_samples = 0  # Track total speech samples
        self.speech_detected = False
        
    def process(self, pcm_data: bytes) -> bool:
        """
        Process audio chunk and detect end of speech.
        
        Args:
            pcm_data: PCM 16-bit audio chunk
        
        Returns:
            True if end of speech detected (silence after sufficient speech)
        """
        # Calculate RMS energy
        try:
            rms = audioop.rms(pcm_data, 2)  # 2 = 16-bit samples
        except:
            return False
        
        samples_in_chunk = len(pcm_data) // 2  # 16-bit = 2 bytes per sample
        is_silence = rms < self.threshold
        
        if not is_silence:
            # Speech detected
            self.speech_detected = True
            self.silence_samples = 0
            self.speech_samples += samples_in_chunk
            return False
        
        if self.speech_detected:
            # Accumulate silence after speech
            self.silence_samples += samples_in_chunk
            
            # Calculate durations
            silence_duration = (self.silence_samples / self.sample_rate) * 1000
            speech_duration = (self.speech_samples / self.sample_rate) * 1000
            
            # Only trigger end of speech if:
            # 1. Silence duration exceeds threshold
            # 2. AND we have minimum speech duration (to avoid cutting off mid-sentence)
            if silence_duration >= self.silence_duration_ms:
                if speech_duration >= self.min_speech_duration_ms:
                    return True
                # If not enough speech yet, reset silence counter to allow more speech
                # This prevents very short utterances from being processed
        
        return False
    
    def reset(self):
        """Reset detector state for new utterance."""
        self.silence_samples = 0
        self.speech_samples = 0
        self.speech_detected = False
def sarvam_to_exotel_pcm(pcm_data: bytes, input_rate: int = 24000) -> bytes:
    """
    Convert Sarvam TTS output to Exotel PCM format.
    Sarvam TTS output (Linear16 24kHz) -> Exotel (Linear16 8kHz).
    Returns 16-bit PCM at 8000 Hz, mono.
    """
    if input_rate != 8000:
        return resample(pcm_data, input_rate, 8000, sample_width=2)
    return pcm_data

class ExotelAudioChunker:
    """
    Accumulates audio bytes and emits chunks that satisfy Exotel Voicebot requirements.
    Chunks are buffered to target_chunk_size (default 3200 bytes) and always emitted
    as a multiple of 320 bytes.
    """
    def __init__(self, target_chunk_size: int = 3200):
        # Ensure the target chunk size itself is a multiple of 320
        self.target_chunk_size = target_chunk_size - (target_chunk_size % 320)
        self.buffer = b""

    def add_data(self, data: bytes):
        self.buffer += data
        chunks = []
        while len(self.buffer) >= self.target_chunk_size:
            chunks.append(self.buffer[:self.target_chunk_size])
            self.buffer = self.buffer[self.target_chunk_size:]
        return chunks

    def flush(self):
        chunks = []
        if len(self.buffer) > 0:
            remainder = len(self.buffer) % 320
            final_data = self.buffer
            if remainder != 0:
                # Pad with silence (zeros for PCM) to ensure multiple of 320
                final_data += b"\x00" * (320 - remainder)
            chunks.append(final_data)
            self.buffer = b""
        return chunks

def apply_audio_tuning(raw_audio_bytes: bytes, spd: float = 1.0, vol: float = 1.0, output_format: str = "mp3", **kwargs) -> bytes:
    """
    Applies studio-grade atempo and volume filter to raw audio bytes via FFmpeg.
    """
    if "speed" in kwargs and kwargs["speed"] is not None:
        spd = float(kwargs["speed"])
    if "volume" in kwargs and kwargs["volume"] is not None:
        vol = float(kwargs["volume"])
    if not raw_audio_bytes:
        return raw_audio_bytes
    if abs(spd - 1.0) <= 0.02 and abs(vol - 1.0) <= 0.04:
        return raw_audio_bytes
    try:
        import subprocess, shutil
        ffmpeg_cmd = shutil.which("ffmpeg") or r"C:\Users\kures\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe"
        filters = []
        if abs(spd - 1.0) > 0.02:
            safe_spd = max(0.5, min(2.5, spd))
            filters.append(f"atempo={safe_spd:.2f}")
        if abs(vol - 1.0) > 0.04:
            safe_vol = max(0.3, min(3.0, vol))
            filters.append(f"volume={safe_vol:.2f}")

        if not filters:
            return raw_audio_bytes

        cmd = [
            ffmpeg_cmd, "-i", "pipe:0",
            "-filter:a", ",".join(filters),
            "-f", output_format, "pipe:1",
            "-loglevel", "error"
        ]
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        out, _ = p.communicate(input=raw_audio_bytes)
        if out:
            return out
    except Exception as filter_err:
        pass
    return raw_audio_bytes

