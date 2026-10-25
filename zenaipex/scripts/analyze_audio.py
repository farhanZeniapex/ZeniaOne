import os
import math
import wave

# Analyze test_speech.raw assuming 8kHz, 16-bit, mono (Exotel format)
file_path = "test_speech.raw"

if not os.path.exists(file_path):
    print("No raw file found.")
    exit(1)

with open(file_path, "rb") as f:
    pcm_data = f.read()

# 16-bit PCM = 2 bytes per sample
num_samples = len(pcm_data) // 2

import struct
samples = struct.unpack(f"<{num_samples}h", pcm_data)

peak = max(abs(s) for s in samples) if samples else 0
sum_sq = sum(s * s for s in samples)
rms = math.sqrt(sum_sq / num_samples) if num_samples > 0 else 0

# Convert to dBFS (max 16-bit value is 32768)
peak_db = 20 * math.log10(peak / 32768.0) if peak > 0 else -float('inf')
rms_db = 20 * math.log10(rms / 32768.0) if rms > 0 else -float('inf')

duration = num_samples / 8000.0

# Silence ratio (samples below a very low threshold, e.g., 100 which is ~ -50dB)
silence_threshold = 200
silence_samples = sum(1 for s in samples if abs(s) < silence_threshold)
silence_ratio = silence_samples / num_samples if num_samples > 0 else 0

print(f"AUDIO_SAMPLE_RATE=8000")
print(f"AUDIO_CHANNELS=1")
print(f"AUDIO_BIT_DEPTH=16")
print(f"AUDIO_DURATION={duration:.2f}s")
print(f"AUDIO_RMS={rms:.2f} ({rms_db:.2f} dBFS)")
print(f"AUDIO_PEAK={peak} ({peak_db:.2f} dBFS)")
print(f"AUDIO_SILENCE_RATIO={silence_ratio:.2f}")

if rms_db < -35:
    print("WARNING: Audio is very quiet!")
if peak_db > -0.5:
    print("WARNING: Audio is clipping!")
