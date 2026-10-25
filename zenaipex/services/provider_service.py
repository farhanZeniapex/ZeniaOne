"""
Zenaipex AI — AI Provider service.

Handles fetching, updating, and resolving active AI providers.
"""
from typing import List, Optional
from datetime import datetime, timezone
import logging

from core.database import col_ai_providers
from core.security import encrypt_secret, decrypt_secret
from core.config import settings
from models.provider import AIProvider
import aiohttp
import time
import os

logger = logging.getLogger(__name__)

# Simple in-memory cache for provider balances to prevent rate-limits and latency
_balance_cache = {}
_cache_ttl = 300  # 5 minutes

async def bootstrap_providers():
    """Reconcile the provider registry with supported environment keys.

    This is intentionally additive: an existing MongoDB-managed key is never
    overwritten by an environment value. Newly added environment providers are
    registered so the admin usage dashboard has one authoritative inventory.
    """
    now = datetime.now(timezone.utc)
    default_providers = [
        {
            "provider": "sarvam", "enabled": True, "priority": 1,
            "api_key": encrypt_secret(settings.sarvam_api_key),
            "model": settings.sarvam_llm_model, "updated_at": now, "updated_by": "system",
        },
        {
            "provider": "gemini", "enabled": False, "priority": 2,
            "api_key": encrypt_secret(settings.gemini_api_key.strip()) if settings.gemini_api_key else encrypt_secret(""),
            "model": settings.gemini_model, "updated_at": now, "updated_by": "system",
        },
        {
            "provider": "groq", "enabled": False, "priority": 3,
            "api_key": encrypt_secret(settings.groq_api_key) if settings.groq_api_key else encrypt_secret(""),
            "model": settings.groq_model, "updated_at": now, "updated_by": "system",
        },
        {
            "provider": "nvidia_1", "enabled": False, "priority": 4,
            "api_key": encrypt_secret(settings.nvidia_api_key_1.strip()) if settings.nvidia_api_key_1 else encrypt_secret(""),
            "model": settings.nvidia_model_1, "updated_at": now, "updated_by": "system",
        },
        {
            "provider": "nvidia_2", "enabled": False, "priority": 5,
            "api_key": encrypt_secret(settings.nvidia_api_key_2.strip()) if settings.nvidia_api_key_2 else encrypt_secret(""),
            "model": settings.nvidia_model_2, "updated_at": now, "updated_by": "system",
        },
    ]

    # OpenAI-compatible providers are optional in the current runtime, but if
    # their keys exist they must still be visible in the provider inventory.
    # Their values are kept server-side and are never returned to the UI.
    env_providers = [
        ("openai", settings.openai_api_key, settings.openai_model, 6),
        ("together", settings.together_api_key, settings.together_model, 7),
        ("cerebras", settings.cerebras_api_key, settings.cerebras_model, 8),
    ]
    for provider_name, api_key, model, priority in env_providers:
        if api_key and api_key.strip():
            default_providers.append({
                "provider": provider_name,
                "enabled": False,
                "priority": priority,
                "api_key": encrypt_secret(api_key.strip()),
                "model": model,
                "updated_at": now,
                "updated_by": "environment-sync",
            })

    existing = await col_ai_providers().find().to_list(length=None)
    existing_by_name = {str(item.get("provider", "")).strip().lower(): item for item in existing}
    inserted = 0
    updated = 0
    for provider in default_providers:
        name = provider["provider"].lower()
        current = existing_by_name.get(name)
        if not current:
            await col_ai_providers().insert_one(provider)
            inserted += 1
            continue
        # Fill only missing credentials/model metadata. DB-managed settings win.
        updates = {}
        current_key = decrypt_secret(current.get("api_key", ""))
        provider_key = decrypt_secret(provider.get("api_key", ""))
        if not str(current_key or "").strip() and str(provider_key or "").strip():
            updates["api_key"] = provider["api_key"]
        if not current.get("model") and provider.get("model"):
            updates["model"] = provider["model"]
        if updates:
            updates["updated_at"] = now
            updates["updated_by"] = "environment-sync"
            await col_ai_providers().update_one({"_id": current["_id"]}, {"$set": updates})
            updated += 1
    if inserted or updated:
        logger.info("Provider registry reconciled: %s added, %s completed from environment", inserted, updated)


async def get_all_providers() -> List[AIProvider]:
    """Get all providers."""
    docs = await col_ai_providers().find().sort("priority", 1).to_list(length=None)
    for d in docs:
        d["id"] = str(d.pop("_id"))
        d["api_key"] = decrypt_secret(d.get("api_key", ""))
    return [AIProvider(**d) for d in docs]


async def get_provider_by_id(provider_id: str) -> Optional[AIProvider]:
    from bson import ObjectId
    doc = await col_ai_providers().find_one({"_id": ObjectId(provider_id)})
    if not doc:
        return None
    doc["id"] = str(doc.pop("_id"))
    doc["api_key"] = decrypt_secret(doc.get("api_key", ""))
    return AIProvider(**doc)

async def update_provider(provider_id: str, updates: dict, actor_email: str) -> Optional[AIProvider]:
    """Update a specific provider."""
    from bson import ObjectId
    
    if "api_key" in updates and updates["api_key"] is not None:
        updates["api_key"] = encrypt_secret(str(updates["api_key"]).strip())
        
    updates["updated_at"] = datetime.now(timezone.utc)
    updates["updated_by"] = actor_email
    
    updated_doc = await col_ai_providers().find_one_and_update(
        {"_id": ObjectId(provider_id)},
        {"$set": updates},
        return_document=True
    )
    
    if not updated_doc:
        return None
        
    updated_doc["id"] = str(updated_doc.pop("_id"))
    updated_doc["api_key"] = decrypt_secret(updated_doc.get("api_key", ""))
    updated = AIProvider(**updated_doc)

    # Keep the already-running process in sync with dashboard changes.  The
    # encrypted DB value is the source of truth, while these assignments make
    # env/settings based voice adapters pick up a replacement key immediately
    # for new sessions without requiring a manual restart.
    if "api_key" in updates:
        provider_name = updated.provider.lower()
        key = updated.api_key or ""
        if provider_name == "gemini":
            os.environ["GEMINI_API_KEY"] = key
            os.environ["GOOGLE_API_KEY"] = key
            try:
                settings.gemini_api_key = key
            except Exception:
                pass
        elif provider_name == "groq":
            os.environ["GROQ_API_KEY"] = key
            try:
                settings.groq_api_key = key
            except Exception:
                pass
        elif provider_name == "sarvam":
            os.environ["SARVAM_API_KEY"] = key
            try:
                settings.sarvam_api_key = key
            except Exception:
                pass
            # Older adapters keep a module-level fallback constant. Refresh it
            # when the module has already been imported in this process.
            import sys
            for module_name in ("modules.sarvam_tts", "modules.sarvam_stt"):
                module = sys.modules.get(module_name)
                if module is not None and hasattr(module, "SARVAM_API_KEY"):
                    module.SARVAM_API_KEY = key
        elif provider_name.startswith("nvidia"):
            suffix = "_1" if provider_name.endswith("_1") else "_2"
            os.environ[f"NVIDIA_API_KEY{suffix}"] = key

    return updated


async def resolve_providers() -> List[AIProvider]:
    """
    Get all enabled providers sorted by priority.
    Raises RuntimeError if no provider is enabled.
    """
    docs = await col_ai_providers().find(
        {"enabled": True}, 
        sort=[("priority", 1)]
    ).to_list(length=None)
    
    if not docs:
        # Fallback to .env if DB is somehow empty, though it shouldn't be due to bootstrap.
        # Check if DB actually has any documents
        if await col_ai_providers().count_documents({}) == 0:
            logger.warning("No providers in DB. Running bootstrap...")
            await bootstrap_providers()
            docs = await col_ai_providers().find(
                {"enabled": True}, 
                sort=[("priority", 1)]
            ).to_list(length=None)
            
        if not docs:
            raise RuntimeError("⚠️ No AI provider is currently enabled in the Super Admin dashboard.")
            
    providers = []
    for doc in docs:
        doc["id"] = str(doc.pop("_id"))
        doc["api_key"] = decrypt_secret(doc.get("api_key", ""))
        providers.append(AIProvider(**doc))
    return providers

async def _fetch_sarvam_balance(api_key: str) -> dict:
    """Attempt to fetch Sarvam usage/balance."""
    # Since Sarvam doesn't have a public well-known billing endpoint, 
    # we return unavailable to avoid dummy data.
    return {
        "purchased_amount": None,
        "account_balance": None,
        "remaining_amount": None,
        "currency": "₹",
        "quota_unavailable": True
    }

async def _fetch_groq_balance(api_key: str) -> dict:
    """Attempt to fetch Groq usage/balance."""
    # Groq API doesn't expose billing over standard endpoints currently.
    return {
        "purchased_amount": None,
        "account_balance": None,
        "remaining_amount": None,
        "currency": "₹",
        "quota_unavailable": True
    }

async def _fetch_gemini_balance(api_key: str) -> dict:
    """Attempt to fetch Gemini usage/balance."""
    # Gemini uses GCP quotas/billing, not easily fetchable via simple API key.
    return {
        "purchased_amount": None,
        "account_balance": None,
        "remaining_amount": None,
        "currency": "₹",
        "quota_unavailable": True
    }

async def _fetch_nvidia_balance(api_key: str) -> dict:
    """Attempt to fetch NVIDIA usage/balance."""
    return {
        "purchased_amount": None,
        "account_balance": None,
        "remaining_amount": None,
        "currency": "₹",
        "quota_unavailable": True
    }

async def get_all_provider_balances(force_refresh: bool = False) -> list:
    """
    Fetch real official balances for all configured providers.
    Uses a 5-minute cache to avoid repeated external API calls.
    """
    global _balance_cache
    now = time.time()
    
    # Check cache unless forced
    if not force_refresh and "data" in _balance_cache and "timestamp" in _balance_cache:
        if now - _balance_cache["timestamp"] < _cache_ttl:
            return _balance_cache["data"]

    providers = await get_all_providers()
    balances = []
    
    for p in providers:
        prov_name = p.provider.lower()
        api_key = p.api_key
        
        balance_data = {
            "provider": prov_name,
            "purchased_amount": None,
            "account_balance": None,
            "remaining_amount": None,
            "currency": "₹",
            "quota_unavailable": True,
            "last_synced": datetime.now(timezone.utc).isoformat()
        }
        
        if api_key and p.enabled:
            try:
                if "sarvam" in prov_name:
                    b = await _fetch_sarvam_balance(api_key)
                elif "groq" in prov_name:
                    b = await _fetch_groq_balance(api_key)
                elif "gemini" in prov_name:
                    b = await _fetch_gemini_balance(api_key)
                elif "nvidia" in prov_name:
                    b = await _fetch_nvidia_balance(api_key)
                else:
                    b = {"quota_unavailable": True}
                    
                balance_data.update(b)
                balance_data["last_synced"] = datetime.now(timezone.utc).isoformat()
            except Exception as e:
                logger.error(f"Failed to fetch balance for {prov_name}: {e}")
                
        balances.append(balance_data)

    _balance_cache["data"] = balances
    _balance_cache["timestamp"] = now
    return balances



async def get_unified_provider_state(days: int = 30) -> list:
    """
    Aggregates provider configuration, historical usage, and current balances into a unified dashboard schema.
    """
    from core.database import col_llm_requests, col_platform_settings
    from datetime import datetime, timedelta, timezone

    # Keep the dashboard inventory current even when a new key was added to
    # .env after the backend process started. This is additive and safe.
    await bootstrap_providers()

    # 1. Get official provider configuration (Source of Truth)
    providers = await get_all_providers()
    
    # 2. Get historical usage
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days-1)).replace(hour=0, minute=0, second=0, microsecond=0)
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": {"provider": "$provider", "model": "$model"},
            "api_calls": {"$sum": 1},
            "input_tokens": {"$sum": "$input_tokens"},
            "output_tokens": {"$sum": "$output_tokens"},
            "total_tokens": {"$sum": "$total_tokens"},
            "success": {"$sum": {"$cond": [{"$eq": ["$success", True]}, 1, 0]}},
            "failed": {"$sum": {"$cond": [{"$eq": ["$success", False]}, 1, 0]}},
            "avg_latency_ms": {"$avg": "$latency_ms"},
            "last_used": {"$max": "$timestamp"}
        }}
    ]
    usage_raw = await col_llm_requests().aggregate(pipeline).to_list(None)
    
    # 3. Get pricing config
    settings_doc = await col_platform_settings().find_one({"type": "global"})
    pricing_conf = settings_doc.get("pricing", {}) if settings_doc else {}
    exchange_rate = pricing_conf.get("usd_to_inr_rate", 86.50) if pricing_conf else 86.50

    # 4. Get active balances
    balances = await get_all_provider_balances(force_refresh=False)
    balance_map = {b["provider"]: b for b in balances}
    
    unified_list = []
    
    for p in providers:
        prov_name = p.provider.lower()
        model_name = p.model
        
        # Aggregate usage specifically for this provider across all its models historically
        api_calls = 0
        input_tokens = 0
        output_tokens = 0
        total_tokens = 0
        success_count = 0
        failure_count = 0
        latency_total = 0.0
        latency_samples = 0
        cost = 0.0
        last_used = None
        
        for row in usage_raw:
            if row["_id"]["provider"].lower() == prov_name:
                api_calls += row.get("api_calls", 0)
                in_toks = row.get("input_tokens", 0)
                out_toks = row.get("output_tokens", 0)
                input_tokens += in_toks
                output_tokens += out_toks
                total_tokens += row.get("total_tokens", 0)
                success_count += row.get("success", 0)
                failure_count += row.get("failed", 0)
                row_calls = row.get("api_calls", 0)
                row_latency = row.get("avg_latency_ms")
                if row_latency is not None and row_calls:
                    latency_total += float(row_latency) * row_calls
                    latency_samples += row_calls
                
                row_time = row.get("last_used")
                if row_time:
                    if not last_used or row_time > last_used:
                        last_used = row_time
                
                # Calculate cost for this specific row's model
                row_model = row["_id"]["model"]
                row_cost = 0.0
                if prov_name in pricing_conf:
                    prov_pricing = pricing_conf[prov_name]
                    if row_model in prov_pricing:
                        row_cost = ((in_toks / 1_000_000) * prov_pricing[row_model].get("input_1m", 0)) + \
                               ((out_toks / 1_000_000) * prov_pricing[row_model].get("output_1m", 0))
                    elif "default" in prov_pricing:
                        row_cost = ((in_toks / 1_000_000) * prov_pricing["default"].get("input_1m", 0)) + \
                               ((out_toks / 1_000_000) * prov_pricing["default"].get("output_1m", 0))
                elif "default" in pricing_conf:
                    row_cost = ((in_toks / 1_000_000) * pricing_conf["default"].get("input_1m", 0)) + \
                           ((out_toks / 1_000_000) * pricing_conf["default"].get("output_1m", 0))
                
                cost += row_cost * exchange_rate

        bal = balance_map.get(prov_name, {})
        quota_unavail = bal.get("quota_unavailable", True)
        
        unified_state = {
            "provider_id": p.id,
            "provider_name": p.provider,
            "model": model_name,
            "enabled": p.enabled,
            "priority": p.priority,
            "usage": {
                "api_calls": api_calls,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "success_count": success_count,
                "failure_count": failure_count,
                "last_used": last_used.isoformat() if last_used else None,
                "latency": round(latency_total / latency_samples, 1) if latency_samples else None,
                "avg_latency_ms": round(latency_total / latency_samples, 1) if latency_samples else None,
            },
            "zeniaai_cost": {
                "amount_inr": cost,
                "pricing_source": "zeniaai_internal"
            },
            "quota": {
                "supported": not quota_unavail,
                "limit": None,
                "used": None,
                "remaining": bal.get("remaining_amount"),
                "used_percent": None,
                "remaining_percent": None,
                "unit": "₹" if not quota_unavail else None,
                "reset_at": None,
                "source": "official" if not quota_unavail else "unsupported"
            },
            "account": {
                "balance": bal.get("account_balance"),
                "purchased": bal.get("purchased_amount"),
                "spend": None,
                "remaining": bal.get("remaining_amount"),
                "currency": bal.get("currency", "₹"),
                "source": "official" if not quota_unavail else "unsupported"
            },
            "sync": {
                "status": "synced" if not quota_unavail else "unsupported",
                "last_synced": bal.get("last_synced", now.isoformat()),
                "error": None
            }
        }
        unified_list.append(unified_state)
        
    return unified_list
