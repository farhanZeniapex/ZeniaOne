"""Reconcile one Exotel line with provider call SIDs. Dry-run unless --apply.

Example:
    python -m scripts.reconcile_exotel_channel --channel-name "Zenia Exotel Main" \
        --start "2026-10-01 00:00:00" --end "2026-10-10 00:00:00"
"""

import argparse
import json
import os
import tempfile
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bson.json_util import dumps
from dotenv import dotenv_values
from pymongo import MongoClient

from services.voice_channel_mapping import phone_numbers_match


IST = timezone(timedelta(hours=5, minutes=30))
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


def provider_time(value: str | None) -> datetime | None:
    if not value:
        return None
    # Exotel's DateCreated aligns with the account's India-local call timestamps.
    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST).astimezone(timezone.utc)


def fetch_calls(env: dict, start: str, end: str) -> list[dict]:
    host = env.get("EXOTEL_SUBDOMAIN") or "api.exotel.com"
    base = f"https://{host}"
    url = f"{base}/v1/Accounts/{env['EXOTEL_ACCOUNT_SID']}/Calls.json"
    auth = (env["EXOTEL_API_KEY"], env["EXOTEL_API_TOKEN"])
    params = {"DateCreated": f"gte:{start};lte:{end}", "PageSize": 100}
    calls: dict[str, dict] = {}
    for _ in range(20):
        response = requests.get(url, auth=auth, params=params, timeout=20)
        response.raise_for_status()
        payload = response.json()
        for call in payload.get("Calls") or []:
            if call.get("Sid"):
                calls[call["Sid"]] = call
        metadata = payload.get("Metadata") or {}
        if len(calls) >= int(metadata.get("Total") or 0):
            return list(calls.values())
        next_uri = metadata.get("NextPageUri")
        if not next_uri:
            break
        url, params = urljoin(base, next_uri), None
    raise RuntimeError("Exotel pagination was incomplete; no database changes made")


def run(args: argparse.Namespace) -> None:
    env = dict(dotenv_values(ENV_PATH))
    for key in ("MONGODB_URI", "EXOTEL_ACCOUNT_SID", "EXOTEL_API_KEY", "EXOTEL_API_TOKEN"):
        if not env.get(key):
            raise RuntimeError(f"Missing {key} in {ENV_PATH}")
    db = MongoClient(env["MONGODB_URI"], serverSelectionTimeoutMS=10_000)[
        env.get("MONGODB_DB_NAME") or "zenaipex"
    ]
    channel = db.channels.find_one({"name": args.channel_name, "type": {"$in": ["exotel", "exotel_voice"]}})
    if not channel:
        raise RuntimeError(f"Exotel channel not found: {args.channel_name}")
    company_id = str(channel["company_id"])
    channel_id = str(channel["_id"])
    number = str(channel.get("phone_number") or "").strip()
    if not number:
        raise RuntimeError("Channel has no phone number")

    provider_calls = [
        call for call in fetch_calls(env, args.start, args.end)
        if phone_numbers_match(call.get("PhoneNumber"), number)
    ]
    if not provider_calls:
        raise RuntimeError("No provider calls match this line; no database changes made")
    sids = [call["Sid"] for call in provider_calls]
    existing = list(db.conversations.find({"call_sid": {"$in": sids}}))
    existing_by_sid = {doc["call_sid"]: doc for doc in existing}
    if len(existing_by_sid) != len(existing):
        raise RuntimeError("Duplicate Call SIDs in MongoDB; resolve before applying")
    if any(str(doc.get("company_id")) != company_id for doc in existing):
        raise RuntimeError("A provider Call SID belongs to another company; no changes made")

    other_channels = list(db.channels.find({"company_id": company_id, "_id": {"$ne": channel["_id"]}}))
    unmatched_channel_records = list(db.conversations.find({
        "company_id": company_id,
        "channel_id": channel_id,
        "$and": [
            {"call_sid": {"$exists": True, "$nin": [None, ""]}},
            {"call_sid": {"$nin": sids}},
        ],
    }))
    wrongly_tagged = []
    for doc in db.conversations.find({"company_id": company_id, "channel_id": channel_id}):
        if doc.get("call_sid") in sids or not doc.get("caller_to"):
            continue
        candidates = [
            candidate for candidate in other_channels
            if candidate.get("phone_number") and phone_numbers_match(candidate["phone_number"], doc["caller_to"])
        ]
        if len(candidates) == 1:
            wrongly_tagged.append((doc, candidates[0]))

    missing = [call for call in provider_calls if call["Sid"] not in existing_by_sid]
    direction_counts = Counter(call.get("Direction") for call in provider_calls)
    summary = {
        "channel": args.channel_name,
        "number": number,
        "provider_calls": len(provider_calls),
        "provider_directions": dict(direction_counts),
        "existing_sid_matches": len(existing),
        "missing_provider_calls": len(missing),
        "other_provider_records_to_reassign": len(wrongly_tagged),
        "unmatched_channel_records_to_archive": len(unmatched_channel_records),
        "channel_phone_needs_trim": channel.get("phone_number") != number,
        "mode": "apply" if args.apply else "dry-run",
    }
    print(json.dumps(summary, indent=2))
    if not args.apply:
        return

    backup_path = Path(tempfile.gettempdir()) / f"zeniaone-exotel-prebackfill-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.json"
    backup_path.write_text(dumps({
        "channel": channel,
        "existing_provider_conversations": existing,
        "other_provider_conversations": [doc for doc, _ in wrongly_tagged],
        "unmatched_channel_conversations": unmatched_channel_records,
        "provider_sids_to_insert": [call["Sid"] for call in missing],
    }, indent=2), encoding="utf-8")
    print(f"Backup: {backup_path}")

    db.channels.update_one({"_id": channel["_id"]}, {"$set": {"phone_number": number}})
    for call in provider_calls:
        sid = call["Sid"]
        doc = existing_by_sid.get(sid)
        if doc:
            provider_direction = (
                "outbound"
                if str(call.get("Direction") or "").lower().startswith("outbound")
                else "inbound"
            )
            # Older Exotel webhook rows were created without direction and
            # defaulted to inbound. For verified outbound calls, the legacy
            # fields contain the customer in caller_phone and our ExoPhone in
            # caller_to, so also populate normalized endpoint fields.
            endpoint_update = {
                "direction": provider_direction,
                "from_phone": doc.get("caller_to") if provider_direction == "outbound" else doc.get("caller_phone"),
                "to_phone": doc.get("caller_phone") if provider_direction == "outbound" else doc.get("caller_to"),
                "destination_phone": doc.get("caller_phone") if provider_direction == "outbound" else doc.get("caller_to"),
                "source_type": "phone_call",
                "provider_verified": True,
                "provider_direction": call.get("Direction"),
                "is_archived": False,
            }
            db.conversations.update_one(
                {"_id": doc["_id"], "company_id": company_id, "call_sid": sid},
                {"$set": {"channel_id": channel_id, "caller_to": number, **endpoint_update}},
            )
            continue
        started = provider_time(call.get("DateCreated"))
        duration = int(call.get("Duration") or 0)
        ended = provider_time(call.get("EndTime")) or (started + timedelta(seconds=duration) if started else None)
        provider_direction = str(call.get("Direction") or "").lower()
        outbound = provider_direction.startswith("outbound")
        provider_from = call.get("From")
        provider_to = call.get("To") or number
        customer_phone = provider_from if outbound and phone_numbers_match(provider_to, number) else provider_to if outbound else provider_from
        new_doc = {
            "company_id": company_id,
            "agent_id": str(channel.get("agent_id") or ""),
            "channel_id": channel_id,
            "call_sid": sid,
            "caller_phone": customer_phone if outbound else provider_from,
            "caller_to": number if outbound else provider_to,
            "from_phone": number if outbound else provider_from,
            "to_phone": customer_phone if outbound else provider_to,
            "destination_phone": customer_phone if outbound else provider_to,
            "direction": "outbound" if outbound else "inbound",
            "status": str(call.get("Status") or "completed").lower(),
            "started_at": started,
            "ended_at": ended,
            "duration_seconds": duration,
            "turn_count": 0,
            "is_archived": False,
            "recording_url": call.get("RecordingUrl") or None,
            "source_type": "phone_call",
            "import_source": "exotel_api_reconciliation",
            "provider_verified": True,
            "provider_direction": call.get("Direction"),
        }
        db.conversations.update_one({"call_sid": sid}, {"$setOnInsert": new_doc}, upsert=True)

    for doc, correct_channel in wrongly_tagged:
        db.conversations.update_one(
            {"_id": doc["_id"], "company_id": company_id, "channel_id": channel_id},
            {"$set": {"channel_id": str(correct_channel["_id"])}},
        )
    for doc in unmatched_channel_records:
        db.conversations.update_one(
            {"_id": doc["_id"], "company_id": company_id, "channel_id": channel_id},
            {"$set": {
                "is_archived": True,
                "provider_verified": False,
                "provider_reconciliation_status": "not_found_in_exotel_window",
            }},
        )
    print("Reconciliation applied.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--channel-name", required=True)
    parser.add_argument("--start", required=True, help="Exotel account-local YYYY-MM-DD HH:MM:SS")
    parser.add_argument("--end", required=True, help="Exotel account-local YYYY-MM-DD HH:MM:SS")
    parser.add_argument("--apply", action="store_true", help="Write the verified reconciliation to MongoDB")
    run(parser.parse_args())
