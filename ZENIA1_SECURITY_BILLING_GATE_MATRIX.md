# ZENIA 1 — SECURITY & BILLING GATE MATRIX

**Date:** 2026-10-12  
**System:** Zenia 1 Voice Assistant Platform  
**Target Root:** `D:\zeniaOne-Voice-Assistant`  

---

### Security & Multi-Tenant Gate Matrix

| Security Check | Implementation | Offline Test Evidence | Production Status |
| :--- | :--- | :--- | :--- |
| **Inbound Webhook Agent Validation** | `col_agents().find_one({"_id": ObjectId(agent_id), "company_id": company_id})` rejects foreign agent | `test_stage_a_forged_inbound_voice_webhook_rejected` | **PASS (Offline)** |
| **Inbound Voicebot Agent Validation** | Rejects unmapped agent with 404 JSON response | `test_stage_a_forged_inbound_voicebot_webhook_rejected` | **PASS (Offline)** |
| **Media Stream WebSocket Tenant Auth** | Closes socket with code 1008 if agent does not belong to company | `test_exotel_calling_regression` | **PASS (Offline)** |
| **Status Webhook Tenant Scoping** | Scoped to `{"company_id": company_id, "call_sid": call_sid}` | `test_exotel_status_webhook_tenant_isolation_and_terminal_guard` | **PASS (Offline)** |
| **Recording Webhook Scoping** | Scoped to `{"company_id": company_id, "call_sid": call_sid}` | `test_recording_webhook_tenant_isolation` | **PASS (Offline)** |
| **Recording Proxy JWT Cryptographic Binding** | Token encodes `company_id` and `conv_id`; proxy blocks foreign tenant with 403 Forbidden | `test_stage_a_recording_token_cryptographic_isolation` | **PASS (Offline)** |
| **Scheduled Job Tenant Scoping** | `cancel_scheduled_call` validates `job.args[0] == channel_id` | `test_cancel_scheduled_call_ownership_check` | **PASS (Offline)** |
| **Pinecone RAG Isolation** | `NamespacedVectorStore` enforces non-empty `company_id` as index namespace | `test_namespace_enforcement_and_empty_namespace_rejection` | **PASS (Offline)** |
| **Carrier HMAC Webhook Verification** | Exotel does not provide standard HMAC signature in current setup | N/A | **BLOCKED (Requires Exotel carrier spec)** |

---

### Billing & Usage Gate Matrix

| Billing Check | Mechanism | Offline Test Evidence | Production Status |
| :--- | :--- | :--- | :--- |
| **Atomic Claim Exactly-Once Billing** | `col_conversations.update_one({"billed": {"$ne": True}})` before increment | `test_billing_idempotency_duplicate_claim_prevention` | **PASS (Offline)** |
| **Duplicate Cleanup Protection** | Second cleanup call has `modified_count == 0` and is skipped | `test_billing_idempotency_duplicate_claim_prevention` | **PASS (Offline)** |
| **Repeated Status Callback Protection** | Terminal status callbacks do not increment usage; guarded by atomic claim | `test_exotel_status_webhook_tenant_isolation_and_terminal_guard` | **PASS (Offline)** |
| **Billing Failure Rollback** | If `increment_usage()` fails, claim reverts to `"billed": False` with error | `test_billing_failure_reverts_claim_and_records_error` | **PASS (Offline)** |
| **Per-Minute Calculation Accuracy** | `call_duration_seconds / 60.0` atomically increments `col_usage_records` | `test_increment_usage_accuracy_and_isolation` | **PASS (Offline)** |
| **Zero-Duration Call Handling** | Duration <= 0 does not increment billable minutes | `test_increment_usage_accuracy_and_isolation` | **PASS (Offline)** |
| **Durable Outbox / Ledger Queue** | System currently updates MongoDB directly; distributed outbox pattern requires migration | N/A | **BLOCKED (Requires Redis/Queue migration)** |
