file_path = r"d:\zeniaOne-Voice-Assistant\zenaipex-frontend\app\admin\agents\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

idx = content.find('const handleTestCustomVoice')
chunk = content[idx:idx+2000]
with open("func_dump.txt", "w", encoding="utf-8") as f:
    f.write(chunk)

print("Done")
