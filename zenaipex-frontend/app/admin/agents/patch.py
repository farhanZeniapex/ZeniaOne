import re

file_path = r"d:\zeniaOne-Voice-Assistant\zenaipex-frontend\app\admin\agents\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Patch loadCustomVoices to use localStorage
old_load = """        if (sorted.length > 0) {
          setSelectedVoiceId(sorted[0].id);
        }"""

new_load = """        if (sorted.length > 0) {
          const savedId = localStorage.getItem('zenaipex_selected_voice_id');
          if (savedId && sorted.find((v: any) => v.id === savedId)) {
            setSelectedVoiceId(savedId);
          } else {
            setSelectedVoiceId(sorted[0].id);
          }
        }"""
content = content.replace(old_load, new_load)

# 1.1 Add useEffect to save selectedVoiceId
old_effect = """  useEffect(() => {
    loadAgents();"""

new_effect = """  useEffect(() => {
    if (selectedVoiceId) {
      localStorage.setItem('zenaipex_selected_voice_id', selectedVoiceId);
    }
  }, [selectedVoiceId]);

  useEffect(() => {
    loadAgents();"""
content = content.replace(old_effect, new_effect)


# 2. Patch handleTestCustomVoice
# Find updateTestAudioSrc(voiceId, finalB64);
# Everything after that until the end of the function needs to be replaced.

# We need to find the specific try...catch block inside handleTestCustomVoice
# It looks like:
#          updateTestAudioSrc(voiceId, finalB64);
#          
#          const audio = new Audio(`data:audio/mp3;base64,${finalB64}`);
#          if (previewAudioRef.current) {
# ...
#      } catch (err) {
#        console.warn("API Error testing voice", err);
#        fallbackBrowser();
#      }
#    };

pattern = r"(updateTestAudioSrc\(voiceId, finalB64\);)([\s\S]*?)(console\.warn\(\"API Error testing voice\", err\);\s*)fallbackBrowser\(\);\s*\}(\s*\};)"

def replacer(m):
    return m.group(1) + """
          setTestingCustomVoiceId(null);
        } else {
          setTestingCustomVoiceId(null);
        }
      } catch (err) {
        """ + m.group(3) + """setTestingCustomVoiceId(null);
      }
    };"""

content = re.sub(pattern, replacer, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch complete.")
