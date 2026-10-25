# ZENIA 1 — STAGING APPROVAL CHECKLIST
## Formal Authorization Protocol for Live Telephony Testing

**Date:** 2026-10-12  
**System:** Zenia 1 Voice Assistant Platform  
**Target Root:** `D:\zeniaOne-Voice-Assistant`  
**Current Status:** **STAGE A (OFFLINE) COMPLETE — ZERO CALLS INITIATED — AWAITING EXPLICIT USER APPROVAL**  

---

### 1. Mandatory Prerequisites Before Live Calls

Before initiating any phone call, all items below must be verified and checked by the platform operator:

- [ ] **Staging Tunnel Active:** Public HTTPS/WSS URL (Ngrok / Cloudflare) configured in `.env` under `PLATFORM_WEBHOOK_BASE_URL`.
- [ ] **Exotel Applet Bound:** Exotel Studio Flow StartVoice Applet 1355682 configured with the active staging webhook URL.
- [ ] **Designated Test Numbers:** Zero real customer numbers. Only approved synthetic or operator-owned test SIM cards used.
- [ ] **Spend Limit Approved:** Operator approves maximum spend budget (Estimated maximum: ₹30 – ₹60 for 10 calls).
- [ ] **Emergency Abort Plan:** Operator can terminate backend process or disable channel via `/channels/{id}` API.

---

### 2. Proposed Staging Call Execution Matrix (10 Calls Max)

| Call # | Direction | Target Language | Scenario | Validation Goal | Max Duration |
| :---: | :---: | :--- | :--- | :--- | :---: |
| **1** | Inbound | Hindi | Standard Greeting & Business Intro | Verify initial greeting latency (<1.5s) and audio clarity | 60s |
| **2** | Inbound | Hindi | Knowledge Base Pricing Query | Verify RAG response relevance without hallucination | 90s |
| **3** | Inbound | Hinglish | Leave Policy & HR Query | Verify entity normalization and code-mixed speech | 90s |
| **4** | Outbound | Hinglish | Appointment Confirmation Reminder | Verify outbound connection and contact name personalization | 60s |
| **5** | Inbound | Gujarati | Customer Service Inquiry | Verify Gujarati language detection & Megha voice playback | 60s |
| **6** | Inbound | Gujarati | Business Address & Hours | Verify company info retrieval in Gujarati | 60s |
| **7** | Inbound | English | Technical Support Query | Verify English speech recognition and Aditya voice playback | 60s |
| **8** | Inbound | English | Billing & Plan Inquiry | Verify English business assistance | 60s |
| **9** | Inbound | Any | Mid-Speech Interruption (Barge-In) | Caller speaks during AI speech; verify cutoff within 400ms | 60s |
| **10** | Inbound | Any | Conjunction Mid-Sentence Pause | Caller pauses mid-sentence ("...aur"); verify AI waits 850ms | 90s |

---

### 3. Live Staging Pass / Fail Metrics

1. **Word Error Rate (WER):** Transcripts must be understandable with >= 85% keyword accuracy.
2. **Language Consistency:** Zero wrong-language responses (AI must respond in the caller's spoken language).
3. **Turnaround Latency (TTFB):** First audible audio frame received by telephone within 2.0s of user speech completion.
4. **Barge-In Delay:** TTS audio ceases within 400ms of user interruption.
5. **Billing Accuracy:** Exactly-once duration recorded in `col_usage_records`; zero duplicate increments.

---

### 4. Operator Authorization Sign-Off

To authorize Stage B execution, the user must provide explicit approval in chat:
> *"I authorize the 10 proposed staging test calls with budget cap ₹60 on number: [+91XXXXXXXXXX]"*

**DO NOT PROCEED WITH REAL CALLS WITHOUT THIS EXPLICIT INPUT.**
