import sys
import re

with open('api/v1/voice_advanced.py', 'r', encoding='utf-8') as f:
    code = f.read()

# First, remove the bad injection inside the docstring
pattern_bad = re.compile(r'\"\"\"\n\s+end_call_flag = False\n\s+if \"<END_CALL>\" in text:\n\s+end_call_flag = True\n\s+text = text\.replace\(\"<END_CALL>\", \"\"\)\.strip\(\)\n\s+import logging\n\s+logger = logging\.getLogger\(__name__\)\n\s+logger\.info\(\"\[END_CALL\] Detected <END_CALL> in LLM response\.\"\)\n\n\s+STEP 3: Mouth - Stream TTS audio back to telephony\.\n\s+Includes BARGE-IN checking!\n\s+\"\"\"')

code = re.sub(r'\"\"\"\s*end_call_flag = False\s*if \"<END_CALL>\" in text:.*?STEP 3: Mouth - Stream TTS audio back to telephony\.\s*Includes BARGE-IN checking!\s*\"\"\"', '\"\"\"\n    STEP 3: Mouth - Stream TTS audio back to telephony.\n    Includes BARGE-IN checking!\n    \"\"\"', code, flags=re.DOTALL)

# Now inject it safely AFTER the docstring
new_code = '''"""
    STEP 3: Mouth - Stream TTS audio back to telephony.
    Includes BARGE-IN checking!
    """
    
    # Strip hyphens for better TTS flow
    text = text.replace("-", " ").replace("-", " ")
    
    end_call_flag = False
    if "<END_CALL>" in text:
        end_call_flag = True
        text = text.replace("<END_CALL>", "").strip()
        import logging
        logger = logging.getLogger(__name__)
        logger.info("[END_CALL] Detected <END_CALL> in LLM response.")'''

code = code.replace('"""\n    STEP 3: Mouth - Stream TTS audio back to telephony.\n    Includes BARGE-IN checking!\n    """', new_code)

with open('api/v1/voice_advanced.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed docstring issue.")
