import sys

with open('api/v1/voice_advanced.py', 'r', encoding='utf-8') as f:
    code = f.read()

search = '''        # If it's english, maybe skip sarvam completely since Sarvam english is often missing or buggy? 
        # Actually Sarvam supports english. Let's try it.
        try:
            async for chunk in realtime_tts_stream(text, language=sarvam_lang, speaker=sarvam_speaker):'''

replace = '''        # If it's english, maybe skip sarvam completely since Sarvam english is often missing or buggy? 
        # Actually Sarvam supports english. Let's try it.
        try:
            if is_greeting:
                # SKIP SARVAM FOR GREETING to prevent 5-second connection delay (EdgeTTS is 10x faster)
                logger.info("[TTS] Bypassing Sarvam for Greeting to ensure Zero-Latency!")
                pass
            else:
                async for chunk in realtime_tts_stream(text, language=sarvam_lang, speaker=sarvam_speaker):'''

code = code.replace(search, replace)

with open('api/v1/voice_advanced.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated greeting to use EdgeTTS for 0 latency.")
