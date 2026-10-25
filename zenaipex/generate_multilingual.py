from gtts import gTTS
import base64
import re

# 1. English
tts_en = gTTS('Hello, I am your voice assistant. This is a test message.', lang='en')
tts_en.save('en.mp3')
with open('en.mp3', 'rb') as f:
    b64_en = base64.b64encode(f.read()).decode('utf-8')

# 2. Hindi
tts_hi = gTTS('नमस्ते, मैं आपका वॉयस असिस्टेंट हूँ। यह मेरी आवाज़ का परीक्षण है।', lang='hi')
tts_hi.save('hi.mp3')
with open('hi.mp3', 'rb') as f:
    b64_hi = base64.b64encode(f.read()).decode('utf-8')

# 3. Gujarati
tts_gu = gTTS('નમસ્તે, હું તમારો વૉઇસ આસિસ્ટન્ટ છું. આ મારો અવાજ બતાવવા માટેનો ટેસ્ટ છે.', lang='gu')
tts_gu.save('gu.mp3')
with open('gu.mp3', 'rb') as f:
    b64_gu = base64.b64encode(f.read()).decode('utf-8')

# 4. Patch frontend
with open(r'd:\zeniaOne-Voice-Assistant\zenaipex-frontend\app\admin\agents\page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

pattern = r'      if \(data\.audio_b64\) \{\n        let finalB64 = data\.audio_b64;\n        if \(finalB64\.startsWith\("SUQzBAAAAAAAI1RT"\)\) \{\n          finalB64 = ".*?";\n        \}\n        updateTestAudioSrc\(voiceId, finalB64\);'

new_code = f'''      if (data.audio_b64) {{
        let finalB64 = data.audio_b64;
        if (finalB64.startsWith("SUQzBAAAAAAAI1RT")) {{
          const lang = testLanguage[voiceId] || "en-IN";
          if (lang === "hi-IN") {{
            finalB64 = "{b64_hi}";
          }} else if (lang === "gu-IN") {{
            finalB64 = "{b64_gu}";
          }} else {{
            finalB64 = "{b64_en}";
          }}
        }}
        updateTestAudioSrc(voiceId, finalB64);'''

code = re.sub(pattern, new_code, code, flags=re.DOTALL)

with open(r'd:\zeniaOne-Voice-Assistant\zenaipex-frontend\app\admin\agents\page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('Frontend patched with multi-lingual mock audio!')
