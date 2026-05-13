import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const asaasEdge = fs.readFileSync("outputs/edge-functions/asaas-create-charge/index.ts", "utf8");
const avatarSql = fs.readFileSync("sql/beta_avatar_storage_fix_2026_05_05.sql", "utf8");
const workoutSql = fs.readFileSync("sql/beta_workout_types_2026_05_05.sql", "utf8");
const messagesSql = fs.readFileSync("sql/beta_messages_delete_fix_2026_05_05.sql", "utf8");
const adminPaymentsSql = fs.readFileSync("sql/beta_admin_professor_payments_2026_05_05.sql", "utf8");
const profileRpcSql = fs.readFileSync("sql/beta_profile_update_rpc_2026_05_05.sql", "utf8");

function has(needle, msg) {
  assert.ok(html.includes(needle), msg || `Missing: ${needle}`);
}

// Profile photo upload: dedicated bucket, validation, preview and safe DB update.
has("function validateImageFile(file)", "image validation must exist");
has("async function uploadAvatarImage(file)", "avatar upload helper must exist");
has(".from(\"avatars\")", "avatar uploads must use avatars bucket");
has("profile-avatar-big", "avatar preview must be updated in the UI");
has("avatar-${Date.now()}.jpg", "avatar upload must avoid stale cache/conflicting upsert path");
has("profileUpdateErrorMessage", "profile update must surface RLS/RPC setup errors clearly");
has('sb.rpc("update_my_avatar_url"', "profile avatar_url must be persisted through safe RPC");
has('sb.rpc("clear_my_avatar_url"', "profile avatar removal must use safe RPC");
has('sb.rpc("update_my_profile_basic"', "profile basic save must use safe RPC");
assert.match(avatarSql, /bucket_id = 'avatars'/, "avatar storage policies must target avatars bucket");
assert.match(avatarSql, /storage\.foldername\(name\)\[1\] = auth\.uid\(\)::text/, "avatar storage must be scoped to user folder");
assert.match(profileRpcSql, /update_my_avatar_url/, "profile RPC migration must update avatar_url");
assert.match(profileRpcSql, /clear_my_avatar_url/, "profile RPC migration must clear avatar_url");
assert.match(profileRpcSql, /update_my_profile_basic/, "profile RPC migration must update basic profile fields");
assert.match(profileRpcSql, /security definer/gi, "profile RPCs must bypass recursive profiles RLS safely");

// Asaas: no fragile FK select; timeout and config errors are surfaced.
has('withTimeout(sb.functions.invoke("asaas-create-charge"', "Asaas function call must have a timeout");
assert.ok(!html.includes("payments_user_id_fkey(*)"), "frontend must not depend on old payment FK name");
assert.ok(!asaasEdge.includes("payments_user_id_fkey(*)"), "edge function must not depend on old payment FK name");
assert.match(asaasEdge, /ASAAS_API_KEY não configurada/, "edge function must explain missing ASAAS_API_KEY");
assert.match(asaasEdge, /https:\/\/api\.asaas\.com\/v3/, "edge function must default to Asaas production endpoint");
assert.match(asaasEdge, /normalizeBillingType/, "edge function must validate billing types");
assert.match(asaasEdge, /fetchExistingCharge/, "edge function must reuse existing Asaas charges");
assert.match(asaasEdge, /payment\.asaas_id/, "edge function must detect existing Asaas charge before creating another one");
assert.match(asaasEdge, /e\?\.status === 404/, "edge function must clear stale sandbox charge ids when production cannot find them");
has("getFunctionInvokeErrorMessage", "Asaas frontend must show Edge Function response details");
has("STATE._lastAsaasError", "Asaas sheet must preserve the real gateway/function error");

// Student financial modal/back and layout.
has('onclick="closeSheet(); renderPayments();"', "financial sheet back must close the modal");
has("beta-grid-2", "financial summary must use responsive grid helper");
has("payment-actions-stack", "payment rows must stack actions on mobile");

// Pull to refresh: duplicate refreshes and overlays must be guarded.
has("refreshing = false", "pull refresh must avoid duplicate refreshes");
has("refreshing = true", "pull refresh must mark active state");
has("function isPullRefreshBlocked()", "pull refresh must only block when overlays are active");
has('sheet.classList.contains("active")', "closed sheet element must not disable pull refresh");
has("function getPullScrollTop(target)", "pull refresh must handle nested scroll containers");
has('document.getElementById("asaas-overlay")', "pull refresh must ignore payment overlay");
has('showToast("Atualizado", "success")', "pull refresh must give success feedback");

// Chat deletion: remove from state and DOM before refetch.
has("data-chat-other", "chat rows must have a stable delete target");
has("STATE.chatThreads = (STATE.chatThreads || []).filter", "chat delete must update local state");
has("row.dataset.chatOther === otherUserId", "chat delete must remove the visible row");
has('sb.rpc("delete_conversation_with_user"', "chat delete must use safe RPC path");
has('.select("id,image_url")', "chat delete must verify rows were actually deleted");
has("Não foi possível excluir. Rode a migration beta_messages_delete_fix_2026_05_05.sql.", "chat delete must not show false success");
assert.match(messagesSql, /for delete using/, "messages delete migration must add delete RLS policy");
assert.match(messagesSql, /delete_conversation_with_user/, "messages delete migration must add RPC fallback");

// Admin finance: direct professor payments are visible and paid/pending amounts are included.
has("async function loadAdminProfessorPayments(coachId)", "admin professor payment sheet loader must exist");
has("STATE.profile?.role === \"admin\"", "admin payment sheet must use admin-safe loader");
assert.match(adminPaymentsSql, /left join public\.payments pay on pay\.user_id = c\.id/, "admin finance must aggregate payments where professor is payer");
assert.match(adminPaymentsSql, /paid_amount_month/, "admin finance must expose paid amount");
assert.match(adminPaymentsSql, /pay\.status in \('pending','overdue'\)/, "admin finance must expose pending/open payments");

// Workout types: professor/admin can create custom workout codes.
has("openCreateWorkoutTypeSheet", "workout type creation sheet must exist");
has("createWorkoutType", "workout type creation handler must exist");
has("STATE.workouts && STATE.workouts[code]", "duplicate workout code guard must exist");
has("coach_id: STATE.profile?.role === \"coach\" ? STATE.profile.id : null", "coach workout types must be scoped");
assert.match(workoutSql, /s\.coach_id = workouts\.coach_id/, "students must only read workout types from their own coach");

// Periodization/editor and cards: mobile polish helpers used.
has("period-toolbar", "periodization toolbar must use responsive helper");
has("period-week-card", "periodization week cards must use consistent card spacing");
has("period-day-editor-head", "period day editor header must be sticky/readable");
has("preset-chip-grid", "preset chips must use responsive grid");
has("student-card-actions", "student/trainer action rows must be mobile-friendly");

// Exercise fallback: missing exact photos use category-specific assets before neutral placeholder.
has("function getCategoryExerciseAssetUrl(ex)", "category-specific exercise fallback must exist");
has("return getCategoryExerciseAssetUrl(ex || {}) || getMissingExerciseImageUrl(ex || {})", "exercise fallback order must prefer category asset");

console.log("qa-beta-critical-fixes-tests: OK");
