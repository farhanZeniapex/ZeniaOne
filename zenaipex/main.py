"""
Zenaipex AI — Main FastAPI Application

Multi-tenant SaaS platform for AI voice agents.

Architecture:
- Shared MongoDB DB (company_id isolation on all collections)
- Single Pinecone index (namespace = company_id per company)
- Platform-owned Sarvam AI + Twilio (Phase 2)
- JWT authentication (email/password)
- Plans: Free Trial / Starter / Professional / Enterprise

Relationship with legacy system:
- This app runs on a SEPARATE port from realtime_app.py
- realtime_app.py (RK Hospital legacy) continues unchanged on its own port
- This app provides the SaaS API that the frontend and future voice layer use
- RK Hospital will be migrated as Company #1 (see scripts/migrate_rk_hospital.py)
"""
import logging
import sys
import os
import asyncio
import time
import re
import uuid

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Add parent directory to path so zenaipex/ can import from itself, and also root for modules/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.config import settings
from core.dependencies import get_platform_admin
from core.database import connect_db, disconnect_db, create_all_indexes

# API Routers
from api.v1 import auth, companies, agents, knowledge, conversations, channels_twilio, channels_enablex, channels_vobiz, channels_vapi, channels, widget, sales, voice_advanced, voices
from api.v1.admin import router as admin_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

if settings.sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            integrations=[FastApiIntegration()],
            traces_sample_rate=settings.sentry_traces_sample_rate,
            send_default_pii=False,
            environment=settings.app_env,
        )
        logger.info("Sentry error tracking enabled")
    except Exception as exc:
        logger.warning("Sentry initialization skipped: %s", exc)

class NoisyEndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        # Filter out noisy GET requests
        if '"GET /api/v1/admin/channels/' in msg and 'HTTP' in msg:
            return False
        if '"GET /api/v1/admin/agents HTTP' in msg:
            return False
        if '"GET /api/v1/admin/companies HTTP' in msg:
            return False
        return True

# Apply filter to uvicorn access logger
logging.getLogger("uvicorn.access").addFilter(NoisyEndpointFilter())


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("=" * 60)
    logger.info(f"🚀 Starting {settings.app_name}")
    logger.info(f"   Environment: {settings.app_env}")
    logger.info(f"   Database: {settings.mongodb_db_name}")
    logger.info("=" * 60)

    # Connect to MongoDB
    connected = await connect_db()
    if connected:
        try:
            await create_all_indexes()
        except Exception as exc:
            logger.warning(f"Index creation warning: {exc}")
            
        # Bootstrap AI Providers
        try:
            from services.provider_service import bootstrap_providers
            await bootstrap_providers()
        except Exception as exc:
            logger.error(f"Failed to bootstrap AI providers: {exc}")

        # Provision the optional production platform-admin account before the
        # admin workspace membership bootstrap runs.
        try:
            await _ensure_platform_admin()
        except Exception as exc:
            logger.warning(f"Platform admin provisioning failed: {exc}")
            
        # Always ensure admin_workspace exists (idempotent)
        try:
            await _ensure_admin_workspace()
        except Exception as exc:
            logger.warning(f"Admin workspace provisioning failed: {exc}")

        # RAG dependencies are loaded lazily on the first knowledge-base request.
        # Keeping model/Pinecone initialization out of startup lets Render's
        # health check pass quickly and keeps the API available during cold starts.
        logger.info("RAG models will be loaded lazily on first knowledge-base request")

        # Start background tasks scheduler (e.g., daily KB sync)
        try:
            from tasks.daily_sync import start_scheduler
            start_scheduler()
        except Exception as exc:
            logger.error(f"Failed to start background scheduler: {exc}")

    yield

    # Shutdown
    try:
        from tasks.daily_sync import stop_scheduler
        stop_scheduler()
    except Exception as exc:
        pass

    try:
        from core.cache import close as close_shared_cache
        await close_shared_cache()
    except Exception as exc:
        logger.debug("Shared cache shutdown skipped: %s", exc)
        
    try:
        await disconnect_db()
    except Exception as exc:
        logger.error(f"Error during disconnect_db: {exc}")
    
    logger.info(f"👋 {settings.app_name} shutdown complete")
    
    # Force process exit on Windows during dev to prevent Uvicorn reload hangs
    if settings.is_development and os.name == "nt":
        import threading
        def _force_exit():
            import time
            time.sleep(0.5)
            os._exit(0)
        threading.Thread(target=_force_exit, daemon=True).start()


async def _ensure_admin_workspace():
    """Idempotently create the admin_workspace company and add all platform admins to it.
    Also creates a default ZeniaAI Assistant agent if none exists.
    """
    from core.database import col_companies, col_users, col_team_members, col_subscriptions, col_agents
    from datetime import datetime, timezone, timedelta
    from slugify import slugify

    now = datetime.now(timezone.utc)

    # 1. Create admin_workspace company if needed
    admin_comp = await col_companies().find_one({"slug": "admin_workspace"})
    if not admin_comp:
        comp_result = await col_companies().insert_one({
            "name": "ZeniaAI Internal Workspace",
            "slug": "admin_workspace",
            "industry": "Software",
            "country": "IN",
            "timezone": "Asia/Kolkata",
            "plan": "enterprise",
            "is_active": True,
            "is_demo": False,
            "settings": {"onboarding_completed": True},
            "created_at": now,
            "updated_at": now,
        })
        comp_id = str(comp_result.inserted_id)
        await col_subscriptions().insert_one({
            "company_id": comp_id,
            "plan": "enterprise",
            "status": "active",
            "limits": {"max_agents": 999, "max_kb_docs": 9999, "max_call_minutes": 999999},
            "created_at": now,
            "updated_at": now,
        })
        logger.info(f"✅ Created admin_workspace: {comp_id}")
    else:
        comp_id = str(admin_comp["_id"])
        logger.info(f"ℹ️  admin_workspace already exists: {comp_id}")

    # 2. Add all platform admins as members
    platform_admins = await col_users().find({"is_platform_admin": True}).to_list(None)
    for admin in platform_admins:
        admin_id = str(admin["_id"])
        existing = await col_team_members().find_one({"company_id": comp_id, "user_id": admin_id})
        if not existing:
            await col_team_members().insert_one({
                "company_id": comp_id,
                "user_id": admin_id,
                "role": "owner",
                "joined_at": now,
            })
            logger.info(f"  Added platform admin {admin.get('email')} to admin_workspace")

    # 3. Create default knowledge base for admin_workspace
    from services.knowledge_service import get_or_create_default_kb
    kb = await get_or_create_default_kb(comp_id, "ZeniaAI Internal Workspace")
    kb_id = str(kb["_id"])

    # 4. Create default ZeniaAI Assistant agent if none exists
    agent_count = await col_agents().count_documents({"company_id": comp_id})
    if agent_count == 0:
        await col_agents().insert_one({
            "company_id": comp_id,
            "knowledge_base_id": kb_id,
            "name": "ZeniaAI Assistant",
            "slug": "zeniaai-assistant",
            "description": "Internal AI assistant for the ZeniaAI platform super admin.",
            "agent_type": "platform_admin",
            "system_prompt": (
                "You are ZeniaAI Assistant, the internal AI for the ZeniaAI platform super admin. "
                "You help with platform management, answering queries about the ZeniaAI SaaS system, "
                "analysing usage data, and providing insights. Be concise, professional, and helpful."
            ),
            "default_language": "en-IN",
            "supported_languages": ["en-IN"],
            "tts_voice": "anushka",
            "tts_model": "bulbul:v3",
            "llm_model": settings.sarvam_llm_model,  # sarvam-105b
            "llm_max_tokens": 1200,
            "llm_temperature": 0.3,
            "greeting_messages": {"en-IN": "Hello! I'm your ZeniaAI internal assistant. How can I help?"},
            "goodbye_messages": {"en-IN": "Goodbye! Have a great day."},
            "max_conversation_turns": 20,
            "silence_timeout_ms": 3000,
            "force_process_timeout_sec": 10,
            "enable_background_audio": False,
            "status": "active",
            "created_at": now,
            "updated_at": now,
        })
        logger.info("✅ Created default ZeniaAI Assistant agent for admin_workspace")


    else:
        # Ensure existing agent has the KB attached
        await col_agents().update_many(
            {"company_id": comp_id, "knowledge_base_id": {"$exists": False}},
            {"$set": {"knowledge_base_id": kb_id}}
        )
        logger.info(f"ℹ️  admin_workspace already has {agent_count} agent(s) (KB linked)")



async def _ensure_platform_admin():
    """Create the configured platform admin once during production bootstrap."""
    admin_email = os.getenv("PLATFORM_ADMIN_EMAIL", "").strip().lower()
    admin_password = os.getenv("PLATFORM_ADMIN_PASSWORD", "")
    if not admin_email or not admin_password:
        return

    from datetime import datetime, timezone
    from core.database import col_users
    from core.security import hash_password

    users = col_users()
    existing = await users.find_one({"email": admin_email})
    if existing:
        updates = {}
        if not existing.get("is_platform_admin"):
            updates["is_platform_admin"] = True
        if not existing.get("is_verified"):
            updates["is_verified"] = True
        if updates:
            updates["updated_at"] = datetime.now(timezone.utc)
            await users.update_one({"_id": existing["_id"]}, {"$set": updates})
            logger.info("✅ Promoted configured platform admin: %s", admin_email)
        return

    now = datetime.now(timezone.utc)
    await users.insert_one({
        "email": admin_email,
        "password_hash": hash_password(admin_password),
        "name": "ZeniaOne Admin",
        "avatar_url": None,
        "is_verified": True,
        "is_platform_admin": True,
        "created_at": now,
        "updated_at": now,
        "last_login_at": None,
    })
    logger.info("✅ Created configured platform admin: %s", admin_email)


# ── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.app_name,
    description=(
        "ZeniaOne — Multi-tenant SaaS platform for AI voice agents. "
        "Powered by Sarvam AI (STT, TTS, LLM) with Pinecone RAG and Twilio."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"] if settings.is_development else [settings.frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-Request-ID"],
)


_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,96}$")


@app.middleware("http")
async def request_correlation(request: Request, call_next):
    """Attach a safe correlation ID to every request and response."""
    incoming_id = request.headers.get("X-Request-ID", "")
    request_id = incoming_id if _REQUEST_ID_RE.fullmatch(incoming_id) else uuid.uuid4().hex
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Add safe browser defaults to every API response."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), geolocation=(), payment=()")
    return response

# Read the maintenance switch from the platform settings document.  Admin
# routes remain available so an administrator can switch it off again; public
# chat, voice and customer API traffic receive a clear 503 response.
_maintenance_cache = {"checked_at": 0.0, "enabled": False, "message": ""}

@app.middleware("http")
async def maintenance_mode_guard(request: Request, call_next):
    path = request.url.path
    allowed_paths = ("/health", "/docs", "/redoc", "/openapi.json", "/api/v1/auth", "/api/v1/admin")
    if path.startswith(allowed_paths):
        return await call_next(request)
    now = time.monotonic()
    if now - _maintenance_cache["checked_at"] > 5:
        try:
            from core.database import col_platform_settings
            document = await col_platform_settings().find_one({"type": "global"}) or {}
            system = document.get("system") or {}
            _maintenance_cache.update({
                "checked_at": now,
                "enabled": bool(system.get("maintenance_mode")),
                "message": str(system.get("maintenance_message") or "System is undergoing maintenance. Please try again shortly."),
            })
        except Exception:
            # A temporary database issue must not accidentally block requests.
            _maintenance_cache["checked_at"] = now
    if _maintenance_cache["enabled"]:
        return JSONResponse(status_code=503, content={"detail": _maintenance_cache["message"], "maintenance": True})
    return await call_next(request)


# ── Exception Handlers ────────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all — log and return 500 for unexpected errors."""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        "Unhandled error request_id=%s on %s %s: %s",
        request_id,
        request.method,
        request.url,
        exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again.", "request_id": request_id},
        headers={"X-Request-ID": request_id},
    )


# ── API Routes ────────────────────────────────────────────────────────────────

API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(companies.router, prefix=API_PREFIX)
app.include_router(agents.router, prefix=API_PREFIX)
app.include_router(knowledge.router, prefix=API_PREFIX)
app.include_router(conversations.router, prefix=API_PREFIX)
app.include_router(channels_twilio.router, prefix=API_PREFIX)
app.include_router(channels_enablex.router, prefix=API_PREFIX)
app.include_router(channels_vobiz.router, prefix=API_PREFIX)
app.include_router(channels_vapi.router, prefix=API_PREFIX)
app.include_router(voice_advanced.router, prefix=API_PREFIX)
app.include_router(voices.router, prefix=API_PREFIX)
app.include_router(channels.router, prefix=API_PREFIX)
app.include_router(widget.router, prefix=API_PREFIX)
app.include_router(sales.router, prefix=API_PREFIX)
app.include_router(admin_router.public_router, prefix=API_PREFIX)
app.include_router(admin_router.router, prefix=API_PREFIX)


# ── Health / Status Endpoints ─────────────────────────────────────────────────

@app.get("/", summary="Platform info", tags=["System"])
async def root():
    return {
        "service": settings.app_name,
        "version": "2.0.0",
        "environment": settings.app_env,
        "status": "active",
        "docs": "/docs",
    }


@app.post("/api/v1/patch-limits", include_in_schema=False)
async def patch_limits(_: dict = Depends(get_platform_admin)):
    from core.database import col_subscriptions, col_companies
    admin_comp = await col_companies().find_one({"slug": "admin_workspace"})
    if admin_comp:
        await col_subscriptions().update_one(
            {"company_id": str(admin_comp["_id"])},
            {"$set": {"limits.max_kb_docs": 9999}}
        )
        return {"patched": True}
    return {"patched": False}

@app.get("/health", tags=["System"])
async def health():
    from core.database import _db
    database = "connected" if _db is not None else "disconnected"
    return {
        "status": "healthy" if database == "connected" else "degraded",
        "database": database,
        "service": settings.app_name,
    }


@app.get("/ready", tags=["System"], summary="Readiness check for deployment monitoring")
async def readiness():
    """Confirm that the API process and its MongoDB dependency are ready."""
    from core.database import _client, _db

    database = "disconnected"
    if _client is not None and _db is not None:
        try:
            await _client.admin.command("ping")
            database = "connected"
        except Exception as exc:
            logger.warning("Readiness database ping failed: %s", exc)

    ready = database == "connected"
    payload = {
        "status": "ready" if ready else "not_ready",
        "service": settings.app_name,
        "database": database,
    }
    if not ready:
        return JSONResponse(status_code=503, content=payload)
    return payload


@app.get("/api/v1/health", tags=["System"], summary="DB mode and persistence status")
async def api_health():
    """
    Public endpoint — no auth required.
    Returns database mode (mongomock / mongodb) and whether data persists across restarts.
    Used by the frontend to display appropriate persistence warnings.
    """
    from core.database import get_db_mode, _db
    mode_info = get_db_mode()
    database = "connected" if _db is not None else "disconnected"
    return {
        "status": "healthy" if database == "connected" else "degraded",
        "service": settings.app_name,
        "db_mode": mode_info["db_mode"],
        "persistent": mode_info["persistent"],
        "db_name": mode_info["db_name"],
        "database": database,
    }


@app.get("/api/v1/plans", summary="Available subscription plans", tags=["System"])
async def list_plans():
    """Return all available plans and their limits."""
    from models.subscription import PLAN_LIMITS
    return {
        "plans": [
            {
                "id": plan,
                "name": plan.replace("_", " ").title(),
                "limits": limits,
            }
            for plan, limits in PLAN_LIMITS.items()
        ]
    }


# ── Dev Only ──────────────────────────────────────────────────────────────────

if settings.is_development:
    @app.get("/api/v1/debug/config", tags=["Debug"])
    async def debug_config():
        """Dev-only: Show non-secret config values."""
        return {
            "app_name": settings.app_name,
            "app_env": settings.app_env,
            "mongodb_db": settings.mongodb_db_name,
            "pinecone_index": settings.pinecone_index_name,
            "sarvam_llm_model": settings.sarvam_llm_model,
            "embedding_model": settings.embedding_model,
            "jwt_algorithm": settings.jwt_algorithm,
            "mongodb_connected": bool(settings.mongodb_uri),
            "pinecone_configured": bool(settings.pinecone_api_key),
            "sarvam_configured": bool(settings.sarvam_api_key),
        }
# Test reload crash

