import re
import logging
logger = logging.getLogger(__name__)
from typing import Dict, Any, Optional
import json

def format_business_hours(bh_str: str, lang: str = "english", script: str = "latin") -> str:
    if not bh_str: return ""
    try:
        data = json.loads(bh_str)
        if not isinstance(data, dict): return bh_str
        lines = []
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        
        # Localize day names if needed, otherwise fallback to English capitalized
        day_names = {
            'monday': 'Monday', 'tuesday': 'Tuesday', 'wednesday': 'Wednesday', 
            'thursday': 'Thursday', 'friday': 'Friday', 'saturday': 'Saturday', 'sunday': 'Sunday'
        }
        
        closed_str = "Closed"
        bh_header = "Our business hours are:"
        holiday_header = "Holidays/Special Closures:"
        
        if script == "devanagari" or lang in ["hindi", "hinglish"]:
            closed_str = "Bandh hai" if lang in ["hindi", "hinglish"] else "बंद है"
            bh_header = "Hamare business hours ye hain:" if lang in ["hindi", "hinglish"] else "हमारे काम करने का समय:"
            holiday_header = "Holidays/Chhutti:" if lang in ["hindi", "hinglish"] else "छुट्टियां:"
        elif script == "gujarati_script" or lang == "gujarati":
            closed_str = "Bandh chhe" if lang == "gujarati" else "બંધ છે"
            bh_header = "Amara business hours aa che:" if lang == "gujarati" else "અમારો કામકાજનો સમય:"
            holiday_header = "Holidays/Raja:" if lang == "gujarati" else "રજાઓ:"
            
        for day in days:
            if day in data:
                day_data = data[day]
                day_display = day_names.get(day, day.capitalize())
                if day_data.get('isOpen'):
                    open_t = day_data.get('openTime') or day_data.get('open') or ''
                    close_t = day_data.get('closeTime') or day_data.get('close') or ''
                    lines.append(f"- {day_display}: {open_t} - {close_t}")
                else:
                    lines.append(f"- {day_display}: {closed_str}")
                    
        holidays = data.get('holidays', [])
        if holidays:
            lines.append(holiday_header)
            for h in holidays:
                lines.append(f"- {h.get('name', 'Holiday')} on {h.get('date', '')}")
        
        if not lines:
            return bh_str
            
        return f"{bh_header}\n" + "\n".join(lines)
    except Exception:
        return bh_str


def build_smart_missing_answer(
    message: str,
    company: Dict[str, Any],
    detected_lang: str,
    detected_script: str,
) -> str:
    """Return a useful, grounded answer when retrieval has no matching evidence.

    This is deliberately conservative: it explains the verified next step without
    inventing a price, feature, policy, or integration detail that is not stored in
    the tenant knowledge base.
    """
    text = re.sub(r"[^\w\s\u0900-\u0d7f]", " ", (message or "").lower(), flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text).strip()
    settings = (company or {}).get("settings", {}) or {}
    email = settings.get("business_email") or settings.get("email")
    phone = settings.get("phone") or settings.get("business_phone")
    contact = f" Contact: {email}." if email else (f" Contact: {phone}." if phone else "")

    calling_terms = ("call", "calling", "voice", "telephony", "ivr", "કોલ", "કૉલિંગ", "કોલિંગ", "એજન્ટ")
    setup_terms = ("setup", "start", "integrat", "deploy", "connect", "configure", "sharu", "શરૂ")
    policy_terms = ("policy", "policies", "refund", "privacy", "terms", "niyam", "પોલિસી")
    is_calling = any(term in text for term in calling_terms)
    is_setup = any(term in text for term in setup_terms)
    is_policy = any(term in text for term in policy_terms)

    if detected_script == "gujarati_script":
        if is_calling:
            return "હા, તમારી કંપની માટે કસ્ટમ AI calling agent setup કરી શકાય છે. તે customer calls handle, FAQsના જવાબ, lead qualification અને call routingમાં મદદ કરી શકે છે. ચોક્કસ per-call કિંમત અને integration details માટે તમારી companyની જરૂરિયાત પ્રમાણે quote બનાવવું પડશે." + contact
        if is_policy:
            return "આ પ્રશ્ન માટે ચોક્કસ company policy મારી verified knowledgeમાં ઉપલબ્ધ નથી. સાચી policy માટે support અથવા sales teamનો સંપર્ક કરો." + contact
        if is_setup:
            return "આ setup માટે પહેલાં તમારી જરૂરિયાત, call volume, language, phone provider અને Knowledge Base details જોઈશે. પછી યોગ્ય agent configuration અને testing plan આપી શકીએ છીએ." + contact
        return "આ પ્રશ્નનો ચોક્કસ જવાબ મારી verified company informationમાં મળ્યો નથી. તમે service, setup, pricing અથવા support વિશે પૂછો; હું ઉપલબ્ધ માહિતી પ્રમાણે જવાબ આપીશ." + contact

    if detected_lang == "gujarati":
        if is_calling:
            return "Haa, tamari company mate custom AI calling agent setup kari shakai chhe. Te customer calls handle, FAQs na jawab, lead qualification ane call routing ma madad kari shake chhe. Chokkas per-call kimat ane integration details mate tamari jaruriyat pramane quote banavvo padse." + contact
        if is_policy:
            return "Aa prashna mate chokkas company policy mari verified knowledge ma available nathi. Sachi policy mate support athva sales team no sampark karo." + contact
        if is_setup:
            return "Aa setup mate pehla tamari jaruriyat, call volume, language, phone provider ane Knowledge Base details joiye. Pachhi yogya agent configuration ane testing plan aapi shakay." + contact
        return "Aa prashna no chokkas jawab mari verified company information ma malyo nathi. Tame service, setup, pricing athva support vishe pucho; hu available information pramane jawab aapish." + contact

    if detected_lang in ("hindi", "hinglish"):
        if is_calling:
            return "Haan, aapki company ke liye custom AI calling agent setup kiya ja sakta hai. Ye customer calls handle, FAQs ka jawab, lead qualification aur call routing me help kar sakta hai. Exact per-call price aur integration details ke liye aapki requirements ke basis par quote banana hoga." + contact
        if is_policy:
            return "Is question ki exact company policy meri verified knowledge me available nahi hai. Sahi policy ke liye support ya sales team se contact karein." + contact
        if is_setup:
            return "Is setup ke liye pehle aapki requirement, call volume, language, phone provider aur Knowledge Base details chahiye. Uske baad suitable agent configuration aur testing plan diya ja sakta hai." + contact
        return "Is question ka exact jawab meri verified company information me nahi mila. Aap service, setup, pricing ya support ke baare me pooch sakte hain; main verified details ke basis par jawab dunga." + contact

    if is_calling:
        return "Yes, we can help configure a custom AI calling agent for your company. It can handle customer calls, answer FAQs, qualify leads, and route calls. Exact per-call pricing and integration details require a requirements-based quote." + contact
    if is_policy:
        return "That company policy is not available in the verified knowledge base yet. Please contact support or sales for the official policy." + contact
    if is_setup:
        return "To recommend the right setup, we need your call volume, languages, phone provider, routing requirements, and knowledge-base content. We can then prepare the agent configuration and testing plan." + contact
    return "I could not verify the exact answer from the company knowledge base. Please share the specific service, setup, pricing, or support detail you need, and I will answer from verified information." + contact


def check_deterministic_fast_path(
    message: str,
    company: Dict[str, Any],
    agent: Dict[str, Any],
    detected_lang: str,
    detected_script: str,
    preferred_lang: Optional[str] = None
) -> Optional[str]:
    """
    Checks if a user message can be answered deterministically from the company profile
    or as a basic social greeting, bypassing LLM generation and RAG entirely.
    """
    import string
    msg_clean = message.lower().strip()
    # Remove ASCII and Unicode punctuation while preserving Hindi/Gujarati
    # letters, so phrases such as "कैसे हो तुम?" and "Zenya 1..." route
    # through the same deterministic intent rules.
    msg_clean_no_punct = re.sub(r"[^\w\s\u0900-\u0d7f]", "", msg_clean, flags=re.UNICODE).strip()

    # Apply preferred language override if specified
    if preferred_lang == "hinglish":
        detected_lang = "hinglish"
        detected_script = "latin"
    elif preferred_lang == "gujarati":
        detected_lang = "gujarati"
        detected_script = "gujarati_script"
    elif preferred_lang == "english":
        detected_lang = "english"
        detected_script = "latin"

    # ── Gender Determination (Male vs Female Agent Persona) ──
    voice_name = (agent.get("tts_voice") or "").lower()
    MALE_VOICES = {"rohan", "rahul", "aditya", "kabir", "amit", "dev", "varun", "sumit", "arjun", "ashutosh", "ratan", "manan", "aayan", "shubh", "advait", "anand", "tarun", "sunny", "mani", "gokul", "vijay", "mohit", "rehan", "soham"}
    is_male = voice_name in MALE_VOICES
    help_verb = "sakta" if is_male else "sakti"
    hear_verb = "raha" if is_male else "rahi"
    dev_help = "सकता" if is_male else "सकती"
    dev_hear = "रहा" if is_male else "रही"

    # ── Language Switch Commands ──
    if re.search(r"\b(hinglish|roman\s+hindi)\b", msg_clean_no_punct) and any(w in msg_clean_no_punct for w in ["baat", "bolo", "bol", "talk", "speak", "karo", "switch", "change", "use", "me", "mein"]):
        return f"Bilkul! Ab se hum Hinglish mein baat karenge. Bataiye, main aapki kya madad kar {help_verb} hoon?"
    if re.search(r"\b(gujarati|gujrati)\b", msg_clean_no_punct) and any(w in msg_clean_no_punct for w in ["baat", "vaat", "bolo", "bol", "talk", "speak", "karo", "switch", "change", "use", "ma", "me"]):
        return "ચોક્કસ! હવેથી આપણે ગુજરાતીમાં વાત કરીશું. કહો, હું તમારી શું મદદ કરી શકું?"
    if re.search(r"\b(english|angrezi)\b", msg_clean_no_punct) and any(w in msg_clean_no_punct for w in ["baat", "bolo", "bol", "talk", "speak", "karo", "switch", "change", "use", "in"]):
        return "Sure! I will speak with you in English from now on. How can I help you today?"
    if re.search(r"\b(hindi|shuddh\s+hindi)\b", msg_clean_no_punct) and any(w in msg_clean_no_punct for w in ["baat", "bolo", "bol", "talk", "speak", "karo", "switch", "change", "use"]):
        return f"बिल्कुल! अब से हम हिंदी में बात करेंगे। बताइए, मैं आपकी क्या मदद कर {dev_help} हूँ?"
    
    # Use regex to handle repeated characters like hiiii, heyyy, hellooo without false positives
    # Expanded with Indian greetings per user request
    is_greeting = bool(re.match(r"^(h[iy]+|he+l+o+|he+y+|h[iy]+\s+there|good\s+(morning|afternoon|evening)|namaste|kem\s*cho|नमस्कार|નમસ્તે|हेलो|હેલો)$", msg_clean_no_punct))
    is_how_are_you = msg_clean_no_punct in [
        "how are you", "how r u", "how are u", "how are you doing", "kaise ho", "kese ho", "kaise ho aap", 
        "kese ho aap", "kese ho app", "kaise ho app", "aap kaise ho", "app kaise ho", "sab theek", 
        "sab kaisa hai", "kya haal hai", "kya chal raha hai", "kaisa chal raha hai", "kese chal raha hai",
        "kem cho", "kem chho", "kem cho tame", "kem cho tamne", "kema cho tame", 
        "kem chho tame", "tame kem cho", "tame kem chho", "हाउ आर यू", "कैसे हो", "कैसे हो तुम", "कैसे हो आप", "केम છો"
    ]
    is_what_are_you_doing = msg_clean_no_punct in [
        "kya karreho", "kya kar rahe ho", "kya kar rahe ho aap", "kya kar rahi ho", 
        "kya kar rahi ho aap", "kya kar rahe ho app", "aap kya karte ho", "aap kya karti ho",
        "tum kya karte ho", "kya kaam karte ho", "what are you doing", "what do you do",
        "what can you do", "tame shu karo cho", "shu karo cho", "shu kam karo cho"
    ]
    is_thanks = msg_clean_no_punct in [
        "thanks", "thank you", "dhanyawad", "dhanyvad", "dhanyavad", "shukriya", 
        "bahut shukriya", "bohot shukriya", "bahut dhanyavad", "bohot dhanyavad", 
        "aabhar", "આભાર", "धन्यवाद", "thx", "thank u", "many thanks", "kya hai dhanyvad", "dhanyvad kya hai"
    ]
    is_goodbye = msg_clean_no_punct in [
        "bye", "goodbye", "good bye", "see you", "see you later", "tata", "phir milte hain",
        "nahi thank you bye", "nahin thank you bye", "no thank you bye", "बस धन्यवाद", "धन्यवाद बाय", "अलविदा", "આવજો"
    ]
    is_hear_me = msg_clean_no_punct in [
        "can you hear me", "are you there", "sun rahe ho", "kya aap sun rahe ho", 
        "kya app sun rahe ho", "suno", "meri awaz aa rahi hai", "awaz aa rahi hai", 
        "awaz sun rahe ho", "sun pa rahe ho"
    ]
    
    c_name = company.get("name", "our company") if company else "our company"
    if c_name.upper() == "INTERNAL / PLATFORM" or c_name == "ZeniaAI Internal Workspace":
        c_name = "ZeniaOne"
    
    settings = company.get("settings", {}) if company else {}
    
    is_profile_query = False
    profile_response = None

    # Policy questions are common sales/support queries. Handle spelling
    # variants such as "polishi"/"polisy" deterministically so they never fall
    # through to the generic knowledge-base fallback with suggested questions.
    policy_query = any(term in msg_clean_no_punct for term in (
        "policy", "policies", "polishi", "polisy", "policie", "refund policy",
        "privacy policy", "terms", "niyam", "નિયમ", "પોલિસી", "નીતિ", "नीति",
    ))
    if policy_query:
        configured_policy = (
            settings.get("policy") or settings.get("policies") or
            settings.get("privacy_policy") or settings.get("refund_policy") or
            settings.get("terms")
        )
        if configured_policy:
            return str(configured_policy)
        if detected_script == "gujarati_script":
            return "આ કંપનીની ચોક્કસ policy મારી verified knowledgeમાં હાલમાં ઉપલબ્ધ નથી. સાચી માહિતી માટે support અથવા sales teamનો સંપર્ક કરો."
        if detected_lang == "gujarati":
            return "Aa company ni chokkas policy mari verified knowledge ma haal available nathi. Sachi information mate support athva sales team no sampark karo."
        if detected_lang in ["hindi", "hinglish"]:
            return "Is company ki exact policy meri verified knowledge me abhi available nahi hai. Sahi information ke liye support ya sales team se contact karein."
        return "This company policy is not available in the verified knowledge base yet. Please contact support or sales for the official policy."

    # Commercial questions must never receive an invented per-call rate. Use
    # only an explicitly configured company price; otherwise provide a clear
    # sales hand-off with the verified contact details that are available.
    pricing_query = (
        any(word in msg_clean_no_punct for word in (
            "price", "pricing", "cost", "rate", "fee", "charge", "kitna", "kitta",
            "per call", "per-call", "calling agent", "voice agent", "ai agent",
            "કિંમત", "ભાવ", "કોલિંગ", "કૉલિંગ", "કેટલા"
        ))
        and any(word in msg_clean_no_punct for word in (
            "call", "calling", "voice", "agent", "ai", "price", "pricing", "cost",
            "rate", "કોલ", "કોલિંગ", "એજન્ટ", "કિંમત", "ભાવ"
        ))
    )
    if pricing_query:
        configured_price = settings.get("pricing") or settings.get("per_call_price")
        if configured_price:
            if detected_script == "gujarati_script":
                profile_response = (
                    "હા, તમારી કંપની માટે custom AI calling agent setup કરી શકાય છે. "
                    "તે customer calls handle, FAQsના જવાબ, lead qualification અને call routingમાં મદદ કરી શકે છે. "
                    f"હાલમાં configured pricing: {configured_price}. Integration અને final quote તમારી call volume અને requirements પ્રમાણે confirm થશે."
                )
            elif detected_lang == "gujarati":
                profile_response = (
                    "Haa, tamari company mate custom AI calling agent setup kari shakai chhe. "
                    "Te customer calls handle, FAQs na jawab, lead qualification ane call routing ma madad kari shake chhe. "
                    f"Haal ma configured pricing: {configured_price}. Final quote tamara call volume ane requirements pramane confirm thashe."
                )
            elif detected_lang in ["hindi", "hinglish"]:
                profile_response = (
                    "Haan, aapki company ke liye custom AI calling agent setup kiya ja sakta hai. "
                    "Ye customer calls handle, FAQs ka jawab, lead qualification aur call routing me help kar sakta hai. "
                    f"Configured pricing: {configured_price}. Final quote aapke call volume aur requirements ke basis par confirm hoga."
                )
            else:
                profile_response = (
                    "Yes, we can configure a custom AI calling agent for your company. "
                    "It can handle customer calls, answer FAQs, qualify leads, and route calls. "
                    f"Configured pricing: {configured_price}. The final quote depends on your call volume and integration requirements."
                )
        elif detected_script == "gujarati_script":
            profile_response = (
                "હા, તમારી કંપની માટે custom AI calling agent setup કરી શકાય છે. "
                "તે customer calls handle, FAQsના જવાબ, lead qualification અને call routingમાં મદદ કરી શકે છે. "
                "પ્રતિ-કૉલ કિંમત અહીં કન્ફિગર કરેલી નથી, તેથી ખોટી કિંમત બતાવીશ નહીં. "
                "તમારા call volume અને integration requirements પ્રમાણે sales team ચોક્કસ quote આપશે."
            )
        elif detected_lang == "gujarati":
            profile_response = (
                "Haa, tamari company mate custom AI calling agent setup kari shakai chhe. "
                "Te customer calls handle, FAQs na jawab, lead qualification ane call routing ma madad kari shake chhe. "
                "Per-call pricing ahi configure nathi, etle hu khoti kimat nahi kahu. "
                "Tamara call volume ane integration requirements pramane sales team exact quote aapshe."
            )
        elif detected_lang in ["hindi", "hinglish"]:
            profile_response = (
                "Haan, aapki company ke liye custom AI calling agent setup kiya ja sakta hai. "
                "Ye customer calls handle, FAQs ka jawab, lead qualification aur call routing me help kar sakta hai. "
                "Per-call pricing abhi configured nahi hai, isliye main galat price nahi bataunga. "
                "Aapke call volume aur integration requirements ke basis par sales team exact quote degi."
            )
        else:
            profile_response = (
                "Yes, we can configure a custom AI calling agent for your company. "
                "It can handle customer calls, answer FAQs, qualify leads, and route calls. "
                "Per-call pricing is not configured for this workspace yet, so I will not invent a price. "
                "Our sales team can provide an exact quote based on your call volume and integration requirements."
            )
        if settings.get("business_email"):
            profile_response += f" Contact: {settings['business_email']}."
        elif settings.get("phone"):
            profile_response += f" Contact: {settings['phone']}."
        return profile_response
    
    # ── Product Overview Fast Paths ───────────────────────────────────────────
    _z_names = r"(?:zeniaone|zinnia one|zenia one|zenya one|zenya 1|zenia 1|janya one|janya 1|ज़ेन्या वन|ज़ेन्या 1|जेनिया वन|जेनिया 1|zeniaai|zenia ai|zeniya one|zeniya ai|zene one|zene ai|sania one|सानिया वन|ज़ेनिया वन|ज़ेनियावन|zenia|ज़ेनिया|जानेमन|you|the\s+platform)"
    z_one_pattern = re.compile(
        rf"^(what(?:\s+is|'?s)?|tell\s+me\s+(?:more\s+)?about|explain|who\s+are\s+you|who\s+r\s+u|kon\s+cho|व्हाट\s+इस)\s+{_z_names}$|"
        rf"^{_z_names}\s+(kya hai|kya he|kya che|su che|su chhe|ke bare mein batao|ke baare mein batao|ke bare me batao|ke baare me batao|na vara ma|vishe|vishe janavo|kya karta hai|features kya hain|features batao|modules kya hain)$|"
        rf"^(kya hai|kya he|kya che|su che|su chhe)\s+{_z_names}$|"
        rf"^tame\s+{_z_names}\s+(?:chho|cho)\s+ke\s+{_z_names}$|"
        rf"^are\s+you\s+{_z_names}\s+or\s+{_z_names}$|"
        rf"^tame\s+{_z_names}\s+(?:na\s+vara\s+ma\s+su\s+janavso|vishe\s+shu\s+janavo|vishe\s+shu\s+janavso)(?:\s+amne)?$", 
        re.IGNORECASE
    )
    z_hr_pattern = re.compile(
        r"^(what(?:\s+is|'?s)?|tell\s+me\s+(?:more\s+)?about|explain)\s+(zeniahr|zinnia hr|zenia hr|zenya hr|zene hr)$|"
        r"^(zeniahr|zinnia hr|zenia hr|zenya hr|zene hr)\s+(kya hai|kya he|ke bare mein batao|ke bare me batao|kya karta hai|features kya hain|features batao|modules kya hain)$|"
        r"^(kya hai|kya he)\s+(zeniahr|zinnia hr|zenia hr|zenya hr|zene hr)$", 
        re.IGNORECASE
    )

    # ── Authoritative company product catalog ───────────────────────────────
    # Product-count/list questions must not be delegated to a generic model
    # when the trusted company catalog already gives an exact answer.
    product_catalog_pattern = re.compile(
        r"(?:how\s+many|total|count|kitne|kitne\s+saare|kul|कितने|कुल|कौन[-\s]?कौन|कौनसे|कौन\s+से|કેટલા|કુલ|કયા|પ્રોડક્ટ|પ્રોડક્ટ્સ|ઉત્પાદન|products?|product\s+names?|product\s+list|products?\s+ke\s+naam|પ્રોડક્ટ(?:્સ)?\s+ના\s+નામ|प्रोडक्ट(?:्स)?\s+के\s+नाम|उत्पादों?\s+के\s+नाम)",
        re.IGNORECASE,
    )
    product_context_pattern = re.compile(
        r"products?|product|પ્રોડક્ટ|પ્રોડક્ટ્સ|ઉત્પાદન|प्रोडक्ट|उत्पाद|zeniahr|zenia\s*fleets|fleets|tender\s+guruji|tender\s+guruji|zenia\s*chat|ઝેનિયા|ઝેનિયાપેક્સ|ઝેનિયા|જેનિયા|ज़ेनिया|जेनिया",
        re.IGNORECASE,
    )
    if product_catalog_pattern.search(msg_clean_no_punct) and product_context_pattern.search(msg_clean_no_punct):
        logger.info("[PRODUCT_FAST_PATH] topic=authoritative_product_catalog matched=true count=4")
        if detected_script == "devanagari":
            return (
                "ZeniaPex ke total 4 products hain:\n\n"
                "1. ZeniaHR — HR aur payroll management ke liye.\n"
                "2. Zenia Fleets — fleet, vehicles, drivers, trips aur transport operations ke liye.\n"
                "3. Tender Guruji — government tenders aur procurement intelligence ke liye.\n"
                "4. Zenia Chat — WhatsApp-first multilingual customer support AI ke liye."
            )
        if detected_lang == "gujarati" or detected_script == "gujarati_script":
            return (
                "ZeniaPex na kul 4 products chhe:\n\n"
                "1. ZeniaHR — HR ane payroll management mate.\n"
                "2. Zenia Fleets — fleet, vehicles, drivers, trips ane transport operations mate.\n"
                "3. Tender Guruji — government tenders ane procurement intelligence mate.\n"
                "4. Zenia Chat — WhatsApp-first multilingual customer support AI mate."
            )
        if detected_lang in ["hindi", "hinglish"]:
            return (
                "ZeniaPex ke total 4 products hain:\n\n"
                "1. ZeniaHR — HR aur payroll management ke liye.\n"
                "2. Zenia Fleets — fleet, vehicles, drivers, trips aur transport operations ke liye.\n"
                "3. Tender Guruji — government tenders aur procurement intelligence ke liye.\n"
                "4. Zenia Chat — WhatsApp-first multilingual customer support AI ke liye."
            )
        return (
            "ZeniaPex has 4 products:\n\n"
            "1. ZeniaHR — workforce, HR and payroll management.\n"
            "2. Zenia Fleets — fleet, vehicle, driver, trip and transport operations.\n"
            "3. Tender Guruji — government tender and procurement intelligence.\n"
            "4. Zenia Chat — WhatsApp-first multilingual customer-support AI."
        )

    if z_one_pattern.match(msg_clean_no_punct):
        logger.info("[PRODUCT_FAST_PATH] product=ZeniaOne matched=true source=authoritative_product_profile")
        if detected_script == "devanagari":
            return (
                "ZeniaOne ek AI-driven voice agent aur telephony SaaS platform hai. "
                "Isse businesses customer support automate kar sakte hain, AI voice agents deploy kar sakte hain, "
                "telephony workflows manage kar sakte hain aur Knowledge Base se grounded answers de sakte hain."
            )
        if detected_lang == "gujarati" or detected_script == "gujarati_script":
            return (
                "ZeniaOne ek AI-driven voice agent ane telephony SaaS platform chhe. "
                "Business customer support automate kari shake, AI voice agents deploy kari shake, "
                "telephony workflows manage kari shake ane Knowledge Base mathi accurate answers aapi shake."
            )
        if detected_lang in ["hindi", "hinglish"]:
            return (
                "ZeniaOne ek AI-driven voice agent aur telephony SaaS platform hai. "
                "Isse businesses customer support automate kar sakte hain, AI voice agents deploy kar sakte hain, "
                "telephony workflows manage kar sakte hain aur Knowledge Base se accurate answers de sakte hain."
            )
        return (
            "ZeniaOne is an AI-driven voice-agent and telephony SaaS platform. "
            "Businesses can automate customer support, deploy AI voice agents, manage telephony workflows, "
            "and provide grounded answers from their Knowledge Base."
        )

    # ── Proactive Features, Scope & Capabilities Suggestion Fast Path ──
    capabilities_pattern = re.compile(
        r"^(?:"
        r"what\s+can\s+you\s+(?:do|help(?:\s+me)?(?:\s+with)?)|"
        r"how\s+can\s+you\s+help(?:\s+me)?|"
        r"what\s+are\s+your\s+capabilities|"
        r"aap\s+(?:kya\s+kya\s+)?(?:kar\s+sakte\s+ho|madad\s+kar\s+sakte\s+ho)|"
        r"mujhe\s+kya\s+help\s+kar\s+sakte\s+ho|"
        r"tame\s+(?:mane\s+)?(?:shu|su)\s+madad\s+kari\s+shako|"
        r"tame\s+(?:shu|su)\s+kari\s+shako\s+cho|"
        r"what\s+do\s+you\s+know"
        r")$",
        re.IGNORECASE
    )
    if capabilities_pattern.search(msg_clean_no_punct):
        logger.info("[PRODUCT_FAST_PATH] topic=capabilities_suggestions matched=true")
        agent_display_name = agent.get("name", "ZeniaOne Assistant")
        if detected_lang == "gujarati" or detected_script == "gujarati_script":
            return (
                f"હું {c_name} ના ઓફિશિયલ AI વોઇસ આસિસ્ટન્ટ ({agent_display_name}) છું. મારી પાસે તમારા માટે આ તમામ માહિતી અને સુવિધાઓ ઉપલબ્ધ છે:\n\n"
                f"1. 📞 AI વોઇસ એજન્ટ & કોલિંગ: કુદરતી માનવ અવાજમાં ઓટોમેટેડ વોઇસ કોલિંગ અને રીઅલ-ટાઇમ અવાજ સહાયતા.\n"
                f"2. 🏢 કંપની પ્રોફાઇલ & વિગતો: {c_name} ના બિઝનેસ ટાઇમિંગ્સ, ઓફિસ સરનામું, સંપર્ક વિગતો અને સેવાઓ.\n"
                f"3. 📚 નોલેજ બેઝ & પ્રોડક્ટ્સ: અપલોડ કરેલા ડોક્યુમેન્ટ્સ, પ્રોડક્ટ કેટલોગ અને FAQs માંથી સચોટ જવાબો.\n"
                f"4. 🌐 મલ્ટિલિંગ્વલ સપોર્ટ: ગુજરાતી, હિંગ્લિશ, હિન્દી અને અંગ્રેજીમાં રીઅલ-ટાઇમ વાતચીત.\n\n"
                f"💡 તમે મને આ સવાલો પૂછી શકો છો:\n"
                f"• '{c_name} ના મુખ્ય ફીચર્સ શું છે?'\n"
                f"• 'ઓફિસનો સમય અને કોન્ટેક્ટ નંબર આપો.'\n"
                f"• 'વોઇસ એજન્ટ કેવી રીતે કામ કરે છે?'\n\n"
                f"તમે કઈ માહિતી વિશે જાણવા માંગો છો?"
            )
        elif detected_lang in ["hindi", "hinglish"]:
            return (
                f"Main {c_name} ki official AI Voice Assistant ({agent_display_name}) hoon. Mere paas aapke liye yeh sabhi jaankari aur services available hain:\n\n"
                f"1. 📞 AI Voice Agent & Calling: Natural human voice mein automated customer calling, inbound/outbound calls aur voice assistance.\n"
                f"2. 🏢 Company & Business Details: {c_name} ke business timings, office address, contact number aur company policies.\n"
                f"3. 📚 Knowledge Base & Products: Hamare system mein uploaded product catalogs, services, pricing, manuals aur FAQs ke exact answers.\n"
                f"4. 🌐 Multilingual Support: Hinglish, Hindi, Gujarati aur English mein live dynamic baat-cheet (barge-in interruption ke sath).\n\n"
                f"💡 Aap mujhse yeh sawaal pooch sakte hain:\n"
                f"• '{c_name} ke main features aur demo batao.'\n"
                f"• 'Aapke business timings aur contact details kya hain?'\n"
                f"• 'Voice agent setup aur pricing kya hai?'\n\n"
                f"Aap inme se kiske baare mein jaanna chahte hain?"
            )
        else:
            return (
                f"I am the official AI Voice Assistant ({agent_display_name}) for {c_name}. Here is all the information and capabilities available:\n\n"
                f"1. 📞 AI Voice Agent & Calling: Natural human-sounding automated voice calling and interactive assistance.\n"
                f"2. 🏢 Company & Business Details: {c_name}'s business hours, office location, contact details, and policies.\n"
                f"3. 📚 Knowledge Base & Products: Instant, grounded answers from uploaded product catalogs, services, and FAQs.\n"
                f"4. 🌐 Multilingual Capabilities: Seamless real-time conversations across Hinglish, Hindi, Gujarati, and English.\n\n"
                f"💡 Suggested questions you can ask:\n"
                f"• 'What are the main features and capabilities of {c_name}?'\n"
                f"• 'What are your business hours and contact info?'\n"
                f"• 'How do voice agents work?'\n\n"
                f"Which of these would you like to explore?"
            )

    # ── Agent Setup & Document Upload Workflow Fast Path ──
    setup_pattern = re.compile(
        r"(?:"
        r"(?:kaise|how\s+to|process|tarika|steps?)\s+(?:setup|create|banaye|configure|start|upload)|"
        r"(?:setup|create|banane|upload\s+karke|document\s+upload).*(?:process|tarika|kaise|steps?)|"
        r"how\s+(?:can\s+i|to)\s+(?:setup|create|integrate|configure)\s+(?:voice\s+)?agent"
        r")",
        re.IGNORECASE
    )
    if setup_pattern.search(msg_clean_no_punct):
        logger.info("[PRODUCT_FAST_PATH] topic=agent_setup_workflow matched=true")
        if detected_lang == "gujarati" or detected_script == "gujarati_script":
            return (
                f"{c_name} માં કસ્ટમ AI વોઇસ એજન્ટ સેટઅપ કરવાની સ્ટેપ-બાય-સ્ટેપ પ્રક્રિયા:\n\n"
                f"1. 📄 ડોક્યુમેન્ટ અપલોડ: 'Knowledge Base' માં તમારી કંપનીના PDF, Word અથવા ટેક્સ્ટ ડોક્યુમેન્ટ્સ અપલોડ કરો.\n"
                f"2. 🤖 એજન્ટ ક્રિએશન: 'AI Agents' સેક્શનમાં નવો એજન્ટ બનાવો અને તેને નોલેજ બેઝ સાથે જોડો.\n"
                f"3. 🎙️ વોઇસ પસંદગી: રિતુ, રોહન, કાવ્યા અથવા નેહા જેવા નેચરલ ઇન્ડિયન વોઇસ પર્સના પસંદ કરો.\n"
                f"4. 🚀 લાઈવ ટેસ્ટિંગ: વેબ વોઇસ ચેટ અથવા ટેલિફોની ઇન્ટિગ્રેશન સાથે તરત જ કસ્ટમર કોલિંગ શરૂ કરો.\n\n"
                f"શું તમે નોલેજ બેઝ અપલોડ કરવા વિશે વધુ માહિતી મેળવવા માંગો છો?\n\n"
                f"Suggested questions:\n"
                f"- નોલેજ બેઝ અપલોડ કેવી રીતે કરવું?\n"
                f"- વોઇસ પર્સના કેવી રીતે પસંદ કરવી?"
            )
        elif detected_lang in ["hindi", "hinglish"]:
            return (
                f"{c_name} mein custom AI Voice Agent setup karne ka aasan step-by-step process yeh hai:\n\n"
                f"1. 📄 Documents Upload: 'Knowledge Base' section mein apni company ke PDFs, FAQs ya documentation upload karein. Hamara system inka automatic semantic indexing karta hai.\n"
                f"2. 🤖 Agent Creation: 'AI Agents' tab mein naya agent create karein aur use Knowledge Base se link karein.\n"
                f"3. 🎙️ Voice Persona Selection: 11 distinct natural Indian voices (Ritu, Rohan, Neha, Kavya, Amit) me se suitable voice persona select karein.\n"
                f"4. 🚀 Live Deployment: Web Voice Chat ya Twilio Calling telephony ke zariye agent ko customer calling aur support ke liye live karein.\n\n"
                f"Kya aap kisi specific step ke baare mein vistaar se jaanna chahte hain?\n\n"
                f"Suggested questions:\n"
                f"- Knowledge base mein documents kaise upload karein?\n"
                f"- Voice persona kaise select karein?"
            )
        else:
            return (
                f"Here is the step-by-step process to set up a custom AI Voice Agent on {c_name}:\n\n"
                f"1. 📄 Upload Documents: Go to 'Knowledge Base' and upload your company PDFs, manuals, or FAQs. The system automatically indexes them for semantic retrieval.\n"
                f"2. 🤖 Create Agent: Navigate to 'AI Agents', create your agent, and link it to your Knowledge Base.\n"
                f"3. 🎙️ Choose Voice Persona: Pick from 11 natural Indian voices (Ritu, Rohan, Neha, Kavya, etc.) tailored for your business tone.\n"
                f"4. 🚀 Deploy & Call: Go live with interactive Web Voice Chat or integrate with Twilio for inbound/outbound telephony.\n\n"
                f"Would you like detailed guidance on any of these steps?\n\n"
                f"Suggested questions:\n"
                f"- How do I upload documents to the Knowledge Base?\n"
                f"- How do I create a new AI agent?"
            )

    # Only intercept pure identity questions — "what is ZeniaOne" should go through RAG for document-grounded answers
    _identity_queries = [
        "who are you", "who r u", "what is your name", "aap kaun ho", "tum kaun ho",
        "tame kon cho", "kon cho", "aap ka naam", "tumhara naam kya hai", "what's your name"
    ]
    if msg_clean_no_punct in _identity_queries:
        logger.info("[PRODUCT_FAST_PATH] product=ZeniaOne identity matched=true")
        agent_display_name = agent.get("name", "ZeniaOne Assistant")
        if detected_lang == "gujarati" or detected_script == "gujarati_script":
            return f"હું {agent_display_name} છું — {c_name} નો AI Voice Assistant. હું Hinglish, Gujarati, Hindi અને English માં ઓટોમેટેડ voice calling handle કરી શકું છું."
        elif detected_lang in ["hindi", "hinglish"]:
            return f"Main {agent_display_name} hoon — {c_name} ka AI Voice Assistant. Main Hinglish, Gujarati, Hindi aur English mein automated voice calling aur customer support handle karta hoon."
        else:
            return f"I am {agent_display_name} — the AI Voice Assistant for {c_name}. I handle automated voice calling and customer support in Hinglish, Hindi, Gujarati, and English."
            
    if z_hr_pattern.match(msg_clean_no_punct):
        logger.info("[PRODUCT_FAST_PATH] product=ZeniaHR matched=true llm_called=false rag_called=false source=authoritative_product_profile")
        if detected_lang in ["hindi", "hinglish"]:
            return "ZeniaHR ek comprehensive human resources management product hai. Yeh attendance tracking, payroll, aur policies ko manage karne mein madad karta hai."
        else:
            return "ZeniaHR is a comprehensive human resources management product. It streamlines attendance tracking, payroll processing, and policy management."
            
    # ── GUARD: Do not use simple topic fast-paths for relationship/comparison/detailed questions ──
    has_detail_intent = any(pat in msg_clean_no_punct for pat in [
        "relationship", "relation", "difference", "differences", "connect", "connected", "aur", "se kya", "between",
        "step", "steps", "detail", "details", "process", "workflow", "feature", "features", "options", "rule", "rules",
        "kaise", "samjhao", "batao", "list", "push to", "pf", "esic", "pt", "tds", "gst"
    ])
            
    # Deterministic Cache for high-frequency queries
    if not has_detail_intent and "attendance" in msg_clean_no_punct and ("what is" in msg_clean_no_punct or "kya hai" in msg_clean_no_punct):
        logger.info("[PRODUCT_FAST_PATH] topic=attendance matched=true")
        if detected_lang in ["hindi", "hinglish"]:
            return "Attendance module aapko employees ki in aur out timings track karne, leaves manage karne, aur working hours monitor karne ki suvidha deta hai."
        else:
            return "The attendance module allows you to track employee clock-in and clock-out times, manage leaves, and monitor total working hours."
            
    if not has_detail_intent and "payroll" in msg_clean_no_punct and ("what is" in msg_clean_no_punct or "kya hai" in msg_clean_no_punct or "kaise work karta hai" in msg_clean_no_punct):
        logger.info("[PRODUCT_FAST_PATH] topic=payroll matched=true")
        if detected_lang in ["hindi", "hinglish"]:
            return "Payroll module employees ki salary, taxes, deductions, aur bonuses ko calculate aur process karne ka kaam karta hai, taaki salary payment automated ho sake."
        else:
            return "The payroll module automatically calculates and processes employee salaries, taxes, deductions, and bonuses to streamline payments."


    # ── Settings-based Metadata Fast Paths ────────────────────────────────────
    
    # ADDRESS
    if not is_profile_query and settings.get("address"):
        _ADDRESS_RE = re.compile(
            r"""
            ^
            (?:
                (?:what(?:'?s)?|whats|tell\s+me|bata(?:\s+do)?|where(?:'?s)?)\s+
                (?:(?:is|are)\s+)?
                (?:(?:your|ur|aapka|aapki|apki|apna|apni|tamari|aa|the|this|this\s+company(?:s)?)\s+)?
            )?
            (?:address|location|headquarters|hq|city|state|postal\s+code)
            (?:
                \s+(?:kya\s+hai|shu\s+che|che|hai|kaha\s+hai|kahan\s+hai|he|su\s+che)
            |
                \s+are\s+you\s+(?:located|based)
            |
                \s+is\s+(?:it|the\s+company)\s+(?:located|based)
            )?
            $
            |
            ^where\s+are\s+you\s+(?:located|situated|based)$
            |
            ^where\s+is\s+(?:it|the\s+company)$
            """,
            re.VERBOSE | re.IGNORECASE,
        )
        if _ADDRESS_RE.match(msg_clean_no_punct):
            is_profile_query = True
            if detected_lang in ["hindi", "hinglish"]:
                profile_response = f"Hamara address hai: {settings['address']}"
            elif detected_lang == "gujarati":
                profile_response = f"Amaru address chhe: {settings['address']}"
            else:
                profile_response = f"Our address is: {settings['address']}"

    # PHONE
    if not is_profile_query and settings.get("phone"):
        _PHONE_RE = re.compile(
            r"""
            ^
            (?:(?:what(?:'?s)?|whats|tell\s+me|bata(?:\s+do)?)\s+(?:(?:is)\s+)?)?
            (?:(?:your|ur|aapka|aapki|apki|apna|apni|tamaro|aa|the|this\s+company(?:s)?)\s+)?
            (?:phone(?:|s)|phone\s+number(?:s)?|contact(?:|s)|contact\s+number(?:s)?|mobile(?:|s)|whatsapp(?:|s)|whatsapp\s+number)
            (?:
                \s+(?:kya\s+hai|shu\s+che|che|hai|su\s+che)
            |
                \s+is
            )?
            $
            """,
            re.VERBOSE | re.IGNORECASE,
        )
        if _PHONE_RE.match(msg_clean_no_punct):
            is_profile_query = True
            if detected_lang in ["hindi", "hinglish"]:
                profile_response = f"Aap hume is number par contact kar sakte hain: {settings['phone']}"
            elif detected_lang == "gujarati":
                profile_response = f"Tame amne aa number par sampark kari shako chho: {settings['phone']}"
            else:
                profile_response = f"You can contact us at: {settings['phone']}"

    # EMAIL
    if not is_profile_query and settings.get("business_email"):
        _EMAIL_RE = re.compile(
            r"""
            ^
            (?:(?:what(?:'?s)?|whats|tell\s+me|bata(?:\s+do)?)\s+(?:(?:is)\s+)?)?
            (?:(?:your|ur|aapka|aapki|apki|apna|apni|tamaro|aa|the|this\s+company(?:s)?)\s+)?
            (?:email|email\s+address|email\s+id)
            (?:
                \s+(?:kya\s+hai|shu\s+che|che|hai|su\s+che)
            |
                \s+is
            )?
            $
            """,
            re.VERBOSE | re.IGNORECASE,
        )
        if _EMAIL_RE.match(msg_clean_no_punct):
            is_profile_query = True
            if detected_lang in ["hindi", "hinglish"]:
                profile_response = f"Hamara email address hai: {settings['business_email']}"
            elif detected_lang == "gujarati":
                profile_response = f"Amaru email address chhe: {settings['business_email']}"
            else:
                profile_response = f"Our email address is: {settings['business_email']}"

    # WEBSITE
    if not is_profile_query and settings.get("website"):
        _WEBSITE_RE = re.compile(
            r"""
            ^
            (?:(?:what(?:'?s)?|whats|tell\s+me|bata(?:\s+do)?)\s+(?:(?:is)\s+)?)?
            (?:(?:your|ur|aapka|aapki|apki|apna|apni|tamari|aa|the|this\s+company(?:s)?)\s+)?
            (?:website|site|url|web\s+address)
            (?:
                \s+(?:kya\s+hai|shu\s+che|che|hai|su\s+che)
            |
                \s+is
            )?
            $
            """,
            re.VERBOSE | re.IGNORECASE,
        )
        if _WEBSITE_RE.match(msg_clean_no_punct):
            is_profile_query = True
            if detected_lang in ["hindi", "hinglish"]:
                profile_response = f"Hamari website hai: {settings['website']}"
            elif detected_lang == "gujarati":
                profile_response = f"Amari website chhe: {settings['website']}"
            else:
                profile_response = f"Our website is: {settings['website']}"

    # DESCRIPTION / ABOUT
    desc = settings.get("description") or company.get("description")
    if not is_profile_query and desc:
        _DESC_RE = re.compile(
            r"""
            ^
            (?:
                (?:what(?:\s+does)?|what\s+do|how\s+does)\s+
                (?:(?:your|the|this|aa)\s+)?
                (?:company|business)\s+
                (?:do|make|karti\s+hai|kare\s+chhe)
            |
                (?:(?:what(?:'?s)?|whats|tell\s+me|bata(?:\s+do)?|about)\s+)?
                (?:(?:your|ur|the|this|aa)\s+)?
                (?:company|business)\s+
                (?:description|profile|info(?:rmation)?|kya\s+karti\s+hai|shu\s+kare\s+che|kya\s+hai|shu\s+che)
            |
                what\s+services\s+do\s+you\s+provide
            |
                what\s+do\s+you\s+do
            |
                company\s+kya\s+karti\s+hai
            |
                company\s+shu\s+kare\s+chhe
            |
                business
            |
                about\s+company
            )
            $
            """,
            re.VERBOSE | re.IGNORECASE,
        )
        if _DESC_RE.match(msg_clean_no_punct):
            is_profile_query = True
            profile_response = desc

    # BUSINESS HOURS
    if not is_profile_query and settings.get("business_hours"):
        _HOURS_RE = re.compile(
            r"""
            ^
            (?:
                (?:(?:what|which)\s+(?:time|days?)|when)\s+
                (?:are\s+you\s+)?
                (?:open|closed)
            |
                (?:(?:your|ur|the|this\s+company(?:s)?)\s+)?
                (?:business\s+hours|timings?|hours|office\s+time|opening\s+hours|closing\s+hours|working\s+hours)
                (?:\s+(?:kya\s+hai|shu\s+che|che|hai|su\s+che))?
            |
                (?:time\s+kya\s+hai|kab\s+open\s+hota\s+hai|office\s+kab\s+khulta\s+hai|office\s+kab\s+band\s+hota\s+hai|kitni\s+din\s+close\s+rehta(?:he|hai))
            |
                (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:ka|no|nu|ni|ko|morning|evening|afternoon))?
            )
            $
            """,
            re.VERBOSE | re.IGNORECASE,
        )
        if _HOURS_RE.match(msg_clean_no_punct):
            is_profile_query = True
            profile_response = format_business_hours(settings['business_hours'], detected_lang, detected_script)

    # LANGUAGES
    lang_info = settings.get("supported_languages") or settings.get("default_language")
    if not is_profile_query and lang_info:
        _LANG_RE = re.compile(
            r"""
            ^
            (?:
                (?:what|which|how\s+many)\s+
                (?:languages?|bhasha)
                (?:
                    \s+do\s+you\s+(?:support|speak|know)
                |
                    \s+are\s+supported
                |
                    \s+(?:support\s+karte\s+ho|support\s+karo\s+cho)
                )?
            |
                (?:supported\s+languages?)
            |
                (?:languages?)
                (?:\s+(?:supported|kya\s+hai|shu\s+che|che|hai))?
            )
            $
            """,
            re.VERBOSE | re.IGNORECASE,
        )
        if _LANG_RE.match(msg_clean_no_punct):
            is_profile_query = True
            profile_response = f"We support the following languages: {lang_info}"

    # POLICIES
    policy_requested = bool(re.search(r"\b(policy|policies|polisi|polishi|niyam|rules?)\b|પોલિસી|નીતિ|निति|नीति", msg_clean_no_punct, re.IGNORECASE))
    if not is_profile_query:
        for policy_key in ["refund_policy", "cancellation_policy", "privacy_policy", "return_policy", "employee_leave_policy"]:
            if settings.get(policy_key):
                clean_key = policy_key.replace("_", " ")
                if clean_key in msg_clean_no_punct or clean_key.replace(" policy", "") in msg_clean_no_punct:
                    is_profile_query = True
                    profile_response = settings[policy_key]
                    break
        if policy_requested and not is_profile_query:
            if detected_script == "gujarati_script":
                profile_response = "આ કંપનીની policy હાલમાં knowledge base માં configured નથી. કૃપા કરીને support અથવા sales team નો સંપર્ક કરો."
            elif detected_lang == "gujarati":
                profile_response = "Aa company ni policy haal ma knowledge base ma configured nathi. Krupa kari support athva sales team no sampark karo."
            elif detected_lang in ["hindi", "hinglish"]:
                profile_response = "Company policy abhi knowledge base mein configured nahi hai. Kripya support ya sales team se contact karein."
            else:
                profile_response = "The company policy is not configured in the knowledge base yet. Please contact support or sales for the verified policy."
            is_profile_query = True
    
    # ── Regex-based fuzzy matching for direct company metadata ────────────────
    # Runs independently (not as elif) so it catches queries even when the
    # message doesn't match the exact-string timings/hours checks above.
    #
    # Pattern strategy:
    #   - Allow common question prefixes (what is, what's, whats, tell me, bata do …)
    #   - Allow filler words (your, ur, aapka, apki, aapki, aa, tamari, …)
    #   - Allow TYPOS in "company" → comp?a?n?y? fuzzy, and "name" → na?m?e?
    #   - Cover Hinglish & Roman Gujarati equivalents
    #   - Avoid matching broad phrases like "what is your refund policy"

    if not is_profile_query and company and company.get("name"):
        # Fuzzy "company name" detector
        # Matches: company name, compny name, company ka naam, company nu naam shu che,
        #          what is company name, what is ur compny nam, aapki company ka naam kya hai, etc.
        _COMPANY_NAME_RE = re.compile(
            r"""
            (?:                         # optional question prefix
                (?:what(?:'?s)?|whats|bata(?:\s+do)?|tell\s+me|what\s+is|batao|batavo)
                \s+
                (?:(?:is|are|your|ur|aapka|aapki|apki|apna|apni|tamari|aa|tari)\s+)?
            )?
            (?:                         # fuzzy "company" — allow 1–2 dropped vowels
                comp(?:a?n?y?|nay?|eny?|ony?)
                |business
                |vyavsay                # Hindi
                |dhandha                # Hindi/Gujarati colloquial
                |aapki\s+comp\w*        # Hinglish possessive
            )
            (?:                         # optional connector (ka, nu, ki, …)
                \s+(?:ka|ki|nu|na|no|da|di|of)\s+
                |\s+
            )
            (?:                         # fuzzy "name" — allow dropped vowels
                na?m?e?
                |naam
                |nam
                |naaam
                |name\s+(?:kya\s+hai|shu\s+che|che|hai)
                |naam\s+(?:kya\s+hai|shu\s+che|che|hai|bata)
            )
            (?:                         # optional suffix (kya hai, shu che, ?)
                \s*(?:\?|kya\s+hai|shu\s+che|che|hai|batao|batavo)?
            )?
            """,
            re.VERBOSE | re.IGNORECASE,
        )
        if _COMPANY_NAME_RE.fullmatch(msg_clean_no_punct.strip()) or \
           _COMPANY_NAME_RE.search(msg_clean_no_punct) and len(msg_clean_no_punct.split()) <= 10:
            is_profile_query = True
            if detected_script == "devanagari":
                profile_response = f"व्यवसाय का नाम {c_name} है।"
            elif detected_script == "gujarati_script":
                profile_response = f"બિઝનેસનું નામ {c_name} છે."
            elif detected_lang in ["hindi", "hinglish"]:
                profile_response = f"Business ka naam {c_name} hai."
            elif detected_lang == "gujarati":
                profile_response = f"Business nu naam {c_name} chhe."
            else:
                profile_response = f"The company name is {c_name}."

    if not is_profile_query and company and company.get("industry"):
        # Matches all natural variations of industry questions.
        # Key gaps fixed vs previous version:
        #   - "what is your industry" (prefix: what is)
        #   - "what industry are you in" (keyword in middle)
        #   - "aap kis industry mein ho" (Hinglish)
        #   - "company nu industry shu che" (Gujarati)
        _INDUSTRY_RE = re.compile(
            r"""
            ^
            (?:
                # English patterns with keyword in middle or end
                (?:what(?:\s+is)?(?:'?s)?|whats|which)
                \s+
                (?:(?:your|ur|the|this\s+company['']?s?)\s+)?
                industry
                (?:\s+(?:are\s+you\s+(?:in|part\s+of)|is\s+this|do\s+you\s+work\s+in))?
            |
                # Short forms: "your industry", "industry"
                (?:(?:your|ur|aapki?|apki?|tamari|aa\s+company(?:\s+ni)?)\s+)?
                industry
                (?:\s+(?:kya\s+hai|shu\s+che|che|hai))?
            |
                # Hinglish: "aap kis industry mein ho"
                aap\s+kis\s+industry\s+(?:mein|me|mai)\s+(?:ho|hain|hai)
            |
                # Gujarati: "company nu industry shu che"
                (?:company\s+(?:nu|ni|na|no)\s+)?industry\s+(?:shu\s+che|che|shun\s+chhe)
            |
                # Hindi: "kya industry hai"
                (?:kya\s+)?(?:aapki|apki)\s+industry\s+(?:hai|kya\s+hai)
            |
                # Tell/bata variants
                (?:tell\s+me|bata(?:o|vo)?)\s+(?:(?:your|ur|aapki?)\s+)?industry
            )
            $
            """,
            re.VERBOSE | re.IGNORECASE,
        )
        if _INDUSTRY_RE.match(msg_clean_no_punct):
            is_profile_query = True
            ind = company["industry"]
            if detected_script == "devanagari":
                profile_response = f"हम {ind} इंडस्ट्री में काम करते हैं।"
            elif detected_script == "gujarati_script":
                profile_response = f"અમે {ind} ઇન્ડસ્ટ્રીમાં કામ કરીએ છીએ."
            elif detected_lang in ["hindi", "hinglish"]:
                profile_response = f"Aapki company ki industry {ind} hai."
            elif detected_lang == "gujarati":
                profile_response = f"Company ni industry {ind} chhe."
            else:
                profile_response = f"The industry is {ind}."

    if not is_profile_query and company and company.get("country"):
        # Expand ISO-2 country codes to full names for readable answers
        _ISO2_NAMES = {
            "IN": "India", "US": "United States", "GB": "United Kingdom",
            "AU": "Australia", "CA": "Canada", "SG": "Singapore",
            "AE": "United Arab Emirates", "DE": "Germany", "FR": "France",
            "NZ": "New Zealand", "ZA": "South Africa", "NL": "Netherlands",
        }
        raw_country = company["country"]
        country_display = _ISO2_NAMES.get(raw_country.upper(), raw_country) if len(raw_country) <= 3 else raw_country

        # Matches all natural country-query variations.
        # Key gaps fixed vs previous version:
        #   - "what country are you based in" (suffix "are you based in")
        #   - "which country are you in" (which + suffix)
        #   - "country kaha hai" (Hinglish)
        #   - "aap kis country mein ho" (Hinglish)
        #   - "company nu country shu che" (Gujarati)
        _COUNTRY_RE = re.compile(
            r"""
            ^
            (?:
                # "what/which country are you [based] in/from"
                (?:what|which)\s+country\s+(?:are\s+you\s+(?:based\s+)?(?:in|from)|is\s+this)
            |
                # "where are you based/from"
                where\s+are\s+you\s+(?:based|from)
            |
                # Short: "your country", "country"
                (?:(?:your|ur|aapka|aapki?|apki?|tamaro|tamara|aa\s+company(?:\s+no)?)\s+)?
                country
                (?:\s+(?:kya\s+hai|shu\s+che|che|hai|kaha\s+hai|kahan\s+hai))?
            |
                # Hinglish: "aap kis country mein ho" / "country kaha hai"
                aap\s+kis\s+country\s+(?:mein|me|mai)\s+(?:ho|hain|hai)
                | country\s+(?:kaha|kahan)\s+(?:hai|he)
                | kaha\s+(?:based|se)\s+(?:ho|hain|hai)
            |
                # Gujarati: "company nu country shu che"
                (?:company\s+(?:nu|ni|na|no)\s+)?country\s+(?:shu\s+che|che|shun\s+chhe)
            |
                # Tell/bata variants
                (?:tell\s+me|bata(?:o|vo)?)\s+(?:(?:your|ur|aapka?)\s+)?country
            )
            $
            """,
            re.VERBOSE | re.IGNORECASE,
        )
        if _COUNTRY_RE.match(msg_clean_no_punct):
            is_profile_query = True
            if detected_script == "devanagari":
                profile_response = f"हम {country_display} में स्थित हैं।"
            elif detected_script == "gujarati_script":
                profile_response = f"અમે {country_display} માં સ્થિત છીએ."
            elif detected_lang in ["hindi", "hinglish"]:
                profile_response = f"Aapki company {country_display} mein based hai."
            elif detected_lang == "gujarati":
                profile_response = f"Company {country_display} ma based chhe."
            else:
                profile_response = f"We are based in {country_display}."
    
    # Regex-based descriptive/founder queries
    if not is_profile_query:
        c_name_lower = c_name.lower()
        desc_pattern = rf"^(?:{re.escape(c_name_lower)}\s+)?(what is|who are you|company description|kya hai|what is this|about company)(?:\s+{re.escape(c_name_lower)})?$"
        if re.match(desc_pattern, msg_clean_no_punct) and company.get("description"):
            is_profile_query = True
            profile_response = company.get("description")
            
        founder_pattern = rf"^(?:{re.escape(c_name_lower)}\s+)?(who developed|who created|kisne banaya|kisne develop kiya|founder|creator)(?:\s+{re.escape(c_name_lower)}|.*)?$"
        if re.match(founder_pattern, msg_clean_no_punct):
            is_profile_query = True
            founder_info = settings.get("founder") or "ZeniaOne AI Platform"
            profile_response = f"{c_name} is powered by {founder_info}."

    is_capability_query = msg_clean_no_punct in ["what can you help me with", "what can you do", "help me", "how can you help", "what are your capabilities", "mujhe kya help kar sakte ho"]

    if is_profile_query:
        logger.info("[COMPANY_SETTINGS_FAST_PATH] field=company_metadata source=company_settings")
        return profile_response
        
    elif is_capability_query:
        if detected_script == "devanagari":
            return f"मैं {c_name} की ओर से आपकी मदद के लिए यहाँ हूँ। मैं आपको हमारे बारे में जानकारी देने, आपके सवालों के जवाब देने और सपोर्ट में मदद कर {dev_help} हूँ।"
        elif detected_script == "gujarati_script":
            return f"હું {c_name} તરફથી તમારી મદદ માટે અહી છું. હું તમને અમારા વિશે માહિતી આપવામાં, તમારા પ્રશ્નોના જવાબ આપવામાં અને સપોર્ટમાં મદદ કરી શકું છું."
        elif detected_lang in ["hindi", "hinglish"]:
            return f"Main {c_name} ki taraf se aapki madad ke liye yahan hoon. Main aapko hamare baare mein jaankari dene, aapke sawalon ke jawab dene aur support mein madad kar {help_verb} hoon."
        elif detected_lang == "gujarati":
            return f"Hu {c_name} taraf thi tamari madad mate ahi chu. Hu tamne amara vishe mahiti aavpa ma, tamara prashno na javab aavpa ma ane support ma madad kari shaku chu."
        else:
            return f"I'm here to help you with {c_name}. I can provide information about our business, answer your questions, and assist with support."
            
    elif is_hear_me:
        if detected_script == "devanagari":
            return f"हाँ बिल्कुल! मैं आपको अच्छी तरह सुन पा {dev_hear} हूँ। कहिए, मैं आपकी क्या मदद कर {dev_help} हूँ?"
        elif detected_script == "gujarati_script":
            return "હા ચોક્કસ! હું તમને બરાબર સાંભળી શકું છું. કહો, હું તમારી શી મદદ કરી શકું?"
        elif detected_lang in ["hindi", "hinglish"]:
            return f"Haan bilkul! Main aapko ache se sun {hear_verb} hoon. Kahiye, main aapki kya help kar {help_verb} hoon?"
        elif detected_lang == "gujarati":
            return "Ha bilkul! Hu tamne barabar sambhli shaku chu. Kaho, hu tamari shu madad kari shaku?"
        else:
            return "Yes, I can hear you clearly! How can I help you today?"

    elif is_goodbye:
        if detected_script == "devanagari":
            return "ठीक है, धन्यवाद! फिर मिलते हैं। आपका दिन शुभ हो।"
        if detected_script == "gujarati_script":
            return "બરાબર, આભાર! ફરી મળીએ. તમારો દિવસ શુભ રહે."
        if detected_lang in ["hindi", "hinglish"]:
            return "Theek hai, thank you! Phir milte hain. Aapka din shubh rahe."
        return "Thank you! Goodbye, and have a great day."

    elif is_greeting or is_how_are_you or is_thanks or is_what_are_you_doing:
        # Override name if this is the internal admin workspace but a custom customer agent
        if c_name == "ZeniaOne" and agent.get("agent_type") != "platform_admin":
            agent_clean_name = str(agent.get("name") or "").replace(" Agent", "").replace("ZeniaAI", "ZeniaOne").replace("Zenia AI", "ZeniaOne").strip()
            if agent_clean_name:
                c_name = agent_clean_name
        
        if is_how_are_you:
            if detected_script == "devanagari":
                return f"मैं बिल्कुल ठीक और बढ़िया हूँ, धन्यवाद! आप बताइए, आप कैसे हैं? आज मैं आपकी क्या मदद कर {dev_help} हूँ?"
            elif detected_script == "gujarati_script":
                return "હું એકદમ મજામાં છું, આભાર! તમે કેમ છો? આજે હું તમારી શું મદદ કરી શકું?"
            elif detected_lang in ["hindi", "hinglish"]:
                return f"Main bilkul badhiya hoon, shukriya! Aap bataiye aap kaise hain? Main aapki kya madad kar {help_verb} hoon?"
            elif detected_lang == "gujarati":
                return "Hu ekdam majama chu, aabhar! Tame kem cho? Hu tamari shu madad kari shaku?"
            else:
                return "I'm doing great, thank you! How are you doing today? How can I help you?"
                
        elif is_what_are_you_doing:
            if detected_script == "devanagari":
                return f"मैं {c_name} का AI असिस्टेंट हूँ। मैं आपके सवालों के जवाब देने और हमारी सेवाओं की जानकारी देने के लिए यहाँ हूँ। बताइए, आज मैं आपकी क्या मदद कर {dev_help} हूँ?"
            elif detected_script == "gujarati_script":
                return f"હું {c_name} નો AI assistant છું. હું તમારા પ્રશ્નોના જવાબ આપવા અને અમારી સેવાઓ વિશે માહિતી આપવા માટે અહીં છું. કહો, આજે હું તમારી શું મદદ કરી શકું?"
            elif detected_lang in ["hindi", "hinglish"]:
                return f"Main {c_name} ka AI assistant hoon. Main aapke sawalon ke jawab dene aur company ki services ke baare mein jaankari dene ke liye yahan hoon. Bataiye, main aapki kya madad kar {help_verb} hoon?"
            elif detected_lang == "gujarati":
                return f"Hu {c_name} no AI assistant chu. Hu tamara prashno na jawab aapi shakish ane amari services vishe mahiti aapi shaku chu. Kaho, hu tamari shu madad kari shaku?"
            else:
                return f"I am the AI assistant for {c_name}. I'm here to answer your questions and assist you with our services, features, and support. How can I help you today?"

        elif is_thanks:
            if detected_script == "devanagari":
                return "आपका बहुत-बहुत स्वागत है! कोई और बात हो या सवाल हो तो बेझिझक पूछिए, मुझे आपकी मदद करके खुशी होगी।"
            elif detected_script == "gujarati_script":
                return "તમારું ખૂબ ખૂબ સ્વાગત છે! બીજું કંઈ પૂછવું હોય તો ચોક્કસ જણાવો, તમારી મદદ કરીને મને આનંદ થશે."
            elif detected_lang in ["hindi", "hinglish"]:
                return "Aapka bohot-bohot swagat hai! Aur kuch poochna ho ya koi bhi madad chahiye ho toh zaroor batayein."
            elif detected_lang == "gujarati":
                return "Tamaru khub swagat chhe! Biju kai puchvu hoy to zaroor batavo."
            else:
                return "You're most welcome! Feel free to ask if you need any other help."
                
        else: # is_greeting
            if detected_script == "devanagari":
                return f"नमस्ते! कहिए, आज मैं आपकी किस तरह मदद कर {dev_help} हूँ?"
            elif detected_script == "gujarati_script":
                return "નમસ્તે! કહો, આજે હું તમારી શું મદદ કરી શકું?"
            elif detected_lang in ["hindi", "hinglish"]:
                return f"Namaste! Kahiye, main aapki kya help kar {help_verb} hoon?"
            elif detected_lang == "gujarati":
                return "Namaste! Kaho, hu tamari shu madad kari shaku?"
            else:
                return "Hello! How can I help you today?"
                
    return None


def check_customer_internal_data_guard(
    message: str,
    company: Optional[Dict[str, Any]] = None,
    agent: Optional[Dict[str, Any]] = None,
    detected_lang: str = "english",
    detected_script: str = "latin",
) -> Optional[str]:
    """Intercept customer/playground queries asking for private operational metrics or internal company data.
    
    A customer-facing agent must never leak backend call statistics, database metrics,
    admin passwords, API credentials, or internal operational logs. Instead of searching
    Pinecone for 7 seconds, return an immediate, polite customer support refusal (~30ms).
    """
    msg_clean = message.lower().strip()
    msg_clean_no_punct = re.sub(r"[^\w\s\u0900-\u0d7f]", " ", msg_clean, flags=re.UNICODE)
    msg_clean_no_punct = re.sub(r"\s+", " ", msg_clean_no_punct).strip()

    c_name = company.get("name", "our company") if company else "our company"
    if c_name.upper() == "INTERNAL / PLATFORM" or c_name == "ZeniaAI Internal Workspace":
        c_name = "ZeniaOne"

    # Regex patterns for internal operational / analytics requests
    patterns = [
        # Call / Request volume questions (kal kitne call aaye, last month kitni request aay, etc.)
        r"\b(kal|aaj|yesterday|today|last\s+month|pichhle\s+mahine|is\s+mahine|this\s+month)\b.*\b(call|calls|request|requests|traffic|lead|leads|volume|kitne|kitni)\b",
        r"\b(kitne|kitni|ketla|ketli|how\s+many|total)\b.*\b(call|calls|request|requests|conversations|records|tokens|customers|clients|users)\b",
        r"\b(call|calls|request|requests)\b.*\b(kitne|kitni|ketla|ketli|aaye|aay|aayi|aaythe|aaye\s*the|hue|thaya)\b",
        # Internal platform metrics / database / admin requests
        r"\b(internal\s+(data|metrics|analytics|records|logs|revenue|profit|turnover))\b",
        r"\b(database|mongodb|mongo|server\s+logs|api\s+keys?|admin\s+password|secret\s+key|access\s+token)\b",
    ]

    is_internal_query = any(re.search(pat, msg_clean_no_punct) for pat in patterns)
    if not is_internal_query:
        return None

    if detected_script == "devanagari":
        return (
            f"मैं {c_name} का कस्टमर सपोर्ट असिस्टेंट हूँ। मेरे पास कंपनी के इंटरनल कॉल रिकॉर्ड्स, "
            f"प्लेटफ़ॉर्म एनालिटिक्स या बैकएंड डेटा का एक्सेस नहीं होता है। मैं आपको {c_name} की सेवाओं, "
            f"प्रोडक्ट्स, फीचर्स, प्राइसिंग या सपोर्ट के बारे में जानकारी दे सकता हूँ। बताइए, मैं आपकी क्या मदद करूँ?"
        )
    if detected_script == "gujarati_script":
        return (
            f"હું {c_name} નો customer support assistant છું. મારી પાસે company ના internal call records, "
            f"analytics કે backend data નો access નથી હોતો. હું તમને {c_name} ની services, products, "
            f"pricing કે support વિશે માહિતી આપી શકું છું. કહો, હું તમારી શું મદદ કરી શકું?"
        )
    if detected_lang == "gujarati":
        return (
            f"Hu {c_name} no customer support assistant chu. Mari pase company na internal call records, "
            f"platform analytics ke backend data no access nathi hoto. Hu tamne {c_name} ni services, "
            f"products, pricing ke support vishe mahiti aapi shaku chu. Kaho, hu tamari shu madad kari shaku?"
        )
    if detected_lang in ("hindi", "hinglish"):
        return (
            f"Main {c_name} ka customer support assistant hoon. Mere paas internal call records, "
            f"platform analytics ya backend data ka access nahi hota hai. Main aapko {c_name} ki services, "
            f"products, pricing, features ya support ke baare mein jaankari de sakta hoon. Kahiye, main aapki kya madad karoon?"
        )
    return (
        f"I am the customer support assistant for {c_name}. I do not have access to internal call records, "
        f"operational analytics, or backend platform data. I would be happy to assist you with our services, "
        f"products, pricing, features, or support. How can I help you today?"
    )
