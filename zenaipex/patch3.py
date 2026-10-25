import sys

with open('api/v1/voice_advanced.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix the hyphens explicitly with unicode points
# The special non-breaking hyphen is \u2011 (-) or \u2010 (-) or \u2013 (–) or \u2014 (—)
code = code.replace('text.replace("-", " ").replace("-", " ")', 'text.replace("-", " ").replace("\u2011", " ").replace("\u2012", " ").replace("\u2013", " ").replace("\u2014", " ").replace("_", " ")')

with open('api/v1/voice_advanced.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Hyphens fixed.")
