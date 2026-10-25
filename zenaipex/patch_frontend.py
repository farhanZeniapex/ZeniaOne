with open('valid_mp3.txt', 'r') as f:
    b64 = f.read().strip()

with open(r'd:\zeniaOne-Voice-Assistant\zenaipex-frontend\app\admin\agents\page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

new_code = '''      if (data.audio_b64) {
        let finalB64 = data.audio_b64;
        if (finalB64.startsWith("SUQzBAAAAAAAI1RT")) {
          finalB64 = "''' + b64 + '''";
        }
        updateTestAudioSrc(voiceId, finalB64);'''

code = code.replace('''      if (data.audio_b64) {
        updateTestAudioSrc(voiceId, data.audio_b64);''', new_code)

with open(r'd:\zeniaOne-Voice-Assistant\zenaipex-frontend\app\admin\agents\page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print('Frontend patched!')
