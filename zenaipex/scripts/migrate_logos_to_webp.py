"""Migrate existing uncompressed logos in MongoDB to optimized WebP format."""

import asyncio
import sys
from pathlib import Path

# Add zenaipex root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.database import connect_db, col_platform_settings, col_companies
from services.image_optimizer import optimize_logo_image
from bson.binary import Binary


async def run_migration():
    await connect_db()
    print("Database connected. Starting logo migration...")

    # 1. Platform settings logo
    platform_doc = await col_platform_settings().find_one({"type": "global"})
    if platform_doc:
        platform = platform_doc.get("platform", {})
        raw_data = platform.get("logo_data")
        curr_type = platform.get("logo_content_type") or "image/png"
        if raw_data:
            raw_bytes = bytes(raw_data)
            opt_bytes, opt_type, opt_ext = optimize_logo_image(
                raw_bytes, curr_type, max_dimension=800, quality=85
            )
            await col_platform_settings().update_one(
                {"type": "global"},
                {
                    "$set": {
                        "platform.logo_data": Binary(opt_bytes),
                        "platform.logo_content_type": opt_type,
                        "platform.logo_size": len(opt_bytes),
                        "platform.logo_filename": f"logo.{opt_ext}",
                    }
                },
            )
            reduction = (1.0 - (len(opt_bytes) / len(raw_bytes))) * 100.0
            print(
                f"[Platform Logo] {len(raw_bytes):,} bytes -> {len(opt_bytes):,} bytes ({reduction:.1f}% reduction, {opt_type})"
            )

    # 2. Company logos
    count = 0
    async for comp in col_companies().find({}):
        settings = comp.get("settings", {})
        raw_data = settings.get("logo_data")
        curr_type = settings.get("logo_content_type") or "image/png"
        if raw_data:
            raw_bytes = bytes(raw_data)
            opt_bytes, opt_type, opt_ext = optimize_logo_image(
                raw_bytes, curr_type, max_dimension=800, quality=85
            )
            await col_companies().update_one(
                {"_id": comp["_id"]},
                {
                    "$set": {
                        "settings.logo_data": Binary(opt_bytes),
                        "settings.logo_content_type": opt_type,
                        "settings.logo_size": len(opt_bytes),
                        "settings.logo_filename": f"logo.{opt_ext}",
                    }
                },
            )
            count += 1
            reduction = (1.0 - (len(opt_bytes) / len(raw_bytes))) * 100.0
            print(
                f"[Company Logo: {comp.get('name')}] {len(raw_bytes):,} bytes -> {len(opt_bytes):,} bytes ({reduction:.1f}% reduction, {opt_type})"
            )

    print(f"Migration completed successfully. Migrated 1 platform logo and {count} company logos.")


if __name__ == "__main__":
    asyncio.run(run_migration())
