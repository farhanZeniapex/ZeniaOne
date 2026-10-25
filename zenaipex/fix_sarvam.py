import re

with open('modules/sarvam_tts.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r',\s*pitch=0\.0', '', content)

with open('modules/sarvam_tts.py', 'w', encoding='utf-8') as f:
    f.write(content)
