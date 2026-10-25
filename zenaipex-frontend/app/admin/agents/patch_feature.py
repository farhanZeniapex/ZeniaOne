file_path = r"d:\zeniaOne-Voice-Assistant\zenaipex-frontend\app\admin\agents\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# When mock audio is returned (API failed), use Web Speech API as fallback with custom text
OLD_FALLBACK = '''        if (finalB64.startsWith("SUQzBAAAAAAAI1RT")) {
          const lang = languageOverride || testLanguage[voiceId] || "en-IN";
          if (lang === "hi-IN") {'''

NEW_FALLBACK = '''        if (finalB64.startsWith("SUQzBAAAAAAAI1RT")) {
          const lang = languageOverride || testLanguage[voiceId] || "en-IN";
          // If user typed custom text, use browser TTS since mock audio won't reflect custom text
          const customTyped = testText[voiceId] && testText[voiceId].trim() !== "";
          if (customTyped && typeof window !== "undefined" && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(testText[voiceId]);
            utter.lang = lang;
            utter.rate = 0.95;
            window.speechSynthesis.speak(utter);
            setTestingCustomVoiceId(null);
            return;
          }
          if (lang === "hi-IN") {'''

if OLD_FALLBACK in content:
    content = content.replace(OLD_FALLBACK, NEW_FALLBACK, 1)
    print("SUCCESS - browser TTS fallback added for custom text")
else:
    print("FAIL - pattern not found")
    idx = content.find('finalB64.startsWith("SUQzBAAAAAAAI1RT")')
    print(f"fallback check found at: {idx}")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
