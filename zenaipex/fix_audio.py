from gtts import gTTS
import base64

# Generate audio
tts = gTTS('Hello, this is a test of the mock voice. 1, 2, 3.')
tts.save('test.mp3')

# Encode
with open('test.mp3', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')

# Patch frontend
with open(r'd:\zeniaOne-Voice-Assistant\zenaipex-frontend\app\admin\agents\page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace the mangled part with a fresh patch
import re
# We need to find the block we injected earlier and replace it.
# The block was:
#       if (data.audio_b64) {
#         let finalB64 = data.audio_b64;
#         if (finalB64.startsWith("SUQzBAAAAAAAI1RT")) {
#           finalB64 = "MANGLED_STUFF";
#         }
#         updateTestAudioSrc(voiceId, finalB64);

pattern = r'      if \(data\.audio_b64\) \{\n        let finalB64 = data\.audio_b64;\n        if \(finalB64\.startsWith\("SUQzBAAAAAAAI1RT"\)\) \{\n          finalB64 = ".*?";\n        \}\n        updateTestAudioSrc\(voiceId, finalB64\);'

new_code = f'''      if (data.audio_b64) {{
        let finalB64 = data.audio_b64;
        if (finalB64.startsWith("SUQzBAAAAAAAI1RT")) {{
          finalB64 = "{b64}";
        }}
        updateTestAudioSrc(voiceId, finalB64);'''

code = re.sub(pattern, new_code, code, flags=re.DOTALL)

with open(r'd:\zeniaOne-Voice-Assistant\zenaipex-frontend\app\admin\agents\page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('Frontend fully patched with valid base64!')
