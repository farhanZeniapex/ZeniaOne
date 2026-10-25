# ZENIA 1 — MULTILINGUAL STT & TTS TEST MATRIX

**Date:** 2026-10-12  
**System:** Zenia 1 Voice Assistant Platform  
**Target Root:** `D:\zeniaOne-Voice-Assistant`  

---

### Language Capability & Provider Mapping

| Target Language | STT Provider & Model | Configured STT Language | TTS Primary (Sarvam) | TTS Fallback (Edge Neural) | Offline Verified | Live Staging Required |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **Hindi** | Deepgram Nova-2 | `language=hi` | `hi-IN` (Voice: ritu) | `hi-IN-SwaraNeural` | **PASS** | Accent & noise check |
| **Hinglish** | Deepgram Nova-2 | `language=hi` | `hi-IN` (Voice: ritu) | `hi-IN-SwaraNeural` | **PASS** | Code-mixed terms check |
| **Gujarati** | Deepgram Nova-2 | `language=hi` *(Hardcoded)* | `gu-IN` (Voice: megha) | `gu-IN-DhwaniNeural` | **PARTIAL** | **YES (STT language switch)** |
| **English** | Deepgram Nova-2 | `language=hi` *(Hardcoded)* | `en-IN` (Voice: aditya) | `en-US-AriaNeural` | **PARTIAL** | **YES (STT language switch)** |

---

### Synthetic Test Scenarios (Stage C Offline Results)

| Test ID | Scenario | Spoken Input Sample | Expected Language | Expected Response Handling | Status |
| :---: | :--- | :--- | :---: | :--- | :---: |
| **STT-01** | Standard Hindi Greeting | "नमस्ते, मुझे बिल की जानकारी चाहिए" | `hi-IN` | Natural Hindi response with billing info | **PASS** |
| **STT-02** | Hinglish Query with English Terms | "Mera leave balance kitna hai batao" | `hi-IN` | Entity repaired to "leave", HR answers | **PASS** |
| **STT-03** | Pure Gujarati Inbound | "કેમ છો, મને રજા વિશે માહિતી જોઈએ છે" | `gu-IN` | Synthesizes response via Megha voice | **PASS** |
| **STT-04** | Romanized Gujarati Inbound | "Tamari service ma shu features che" | `gu-IN` | Detected as Gujarati; routes accurately | **PASS** |
| **STT-05** | English Business Inquiry | "Can you explain the annual pricing plan" | `en-US` | Detected as English; Aditya voice | **PASS** |
| **STT-06** | Casual Backchannel | "haan", "ji", "theek hai" | Contextual | Ignored while AI is speaking; not interrupted | **PASS** |
| **STT-07** | Conjunction Mid-Sentence Pause | "Mujhe pricing jaanni hai lekin..." | Incomplete | Waits 850ms delayed flush timer | **PASS** |
| **STT-08** | Meaningful Interruption (Barge-in) | "Ek minute ruko" (during playback) | Interruption | Sets cancel event, stops TTS immediately | **PASS** |
| **STT-09** | Fast-Track Goodbye | "Theek hai, phone rakh raha hoon" | Exit | Emits `<END_CALL>` without LLM delay | **PASS** |
| **STT-10** | Low Confidence Audio Garbage | Noise / static (< 0.0 confidence) | Filtered | Requests polite clarification | **PASS** |

---

### STT & TTS Production Limitations

1. **Nova-2 URL Parameter:** Current WebSocket URL connects with `language=hi`. In staging, testing with pure Gujarati or English speakers will verify if Nova-2 handles Indian English or if a dynamic language parameter per channel is required.
2. **Sarvam Token Authentication:** In production, `SARVAM_API_KEY` must have active balance. Fallback to Edge TTS is verified and automatic if Sarvam fails.
