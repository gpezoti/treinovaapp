import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const socialPeopleEdge = fs.readFileSync("supabase/functions/social-people/index.ts", "utf8");
const sql = fs.readFileSync("sql/social_feed_coach_training_2026_05_08.sql", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260508223000_social_feed_coach_training.sql", "utf8");
const hardening = fs.readFileSync("supabase/migrations/20260602153000_harden_social_people_discovery.sql", "utf8");
const rpcHardening = fs.readFileSync("supabase/migrations/20260714170000_harden_sensitive_rpcs.sql", "utf8");
const anonRpcHardening = fs.readFileSync("supabase/migrations/20260714171000_revoke_anon_sensitive_rpcs.sql", "utf8");

assert.equal(sql, migration, "migration must mirror legacy social script");

assert.match(html, /async function ensureCoachStudentFollows\(\)/);
assert.match(html, /async function trackFeedViews\(posts\)/);
const trackFeedViewsBlock = html.slice(
  html.indexOf("async function trackFeedViews(posts)"),
  html.indexOf("async function loadFeed()"),
);
assert.doesNotMatch(trackFeedViewsBlock, /\.upsert\([\s\S]*?\)\.catch\(/, "Supabase query builders are awaitable, not Promise chains with .catch().");
assert.match(html, /safeLoad\("coach auto-follow", ensureCoachStudentFollows\)/);
assert.match(html, /window\.openSocialList = async function\(type\)/);
assert.match(html, /window\.openPeopleSearch = function\(\)/);
assert.match(html, /window\.onFeedPeopleSearch = function\(q\)/);
assert.match(html, /cacheSocialProfiles/);
assert.match(html, /loadSocialProfilesByIds/);
assert.match(html, /enrichFeedAuthors/);
assert.match(html, /async function hydrateFollowRows/);
assert.match(html, /personDisplayName\(p\.student, "Usuário"\)/);
assert.match(html, /\^\(aluno\|usu\[aá\]rio\|student\)\$/);
assert.match(html, /Encontrar pessoas/);
assert.match(html, /sb\.functions\.invoke\("social-people"/);
assert.match(html, /student:profiles!feed_posts_student_id_fkey\(id, full_name, avatar_emoji, avatar_url, role\)/);
assert.doesNotMatch(html, /student:profiles!feed_posts_student_id_fkey\(id, email/);
assert.match(html, /function peopleRow\(p, context = "sheet"\)/);
assert.doesNotMatch(html, /const sub = \[roleLabel, p\.email\]/);
assert.match(html, /row\?\.profile \|\| profileById\[id\]/);
assert.match(html, /window\.onFollowToggle = async function\(id, currentlyFollowing = null\)/);
assert.match(html, /const ok = currentlyFollowing \? await unfollowUser\(id\) : await followUser\(id\);/);
assert.match(html, /Não foi possível seguir essa pessoa agora\. Tente novamente\./);
assert.match(html, /Não foi possível atualizar quem você segue agora\. Tente novamente\./);
assert.match(html, /let _peopleSearchRequest = 0;/);
assert.match(html, /requestId !== _peopleSearchRequest/);
assert.match(html, /let _feedPeopleSearchRequest = 0;/);
assert.match(html, /requestId !== _feedPeopleSearchRequest/);
assert.match(html, /function renderSelfTrainingCard\(/);
assert.match(html, /\{ id: "feed", label: "Feed"/);
assert.match(html, /\{ id: "workout", label: "Treino"/);
assert.match(html, /if \(isCoach\)[\s\S]*?\{ id: "feed", label: "Feed"/, "coach nav must expose feed directly");
assert.match(html, /profile\.role === "student" \|\| profile\.role === "coach"/);
assert.doesNotMatch(html, /Busque qualquer aluno, treinador ou admin cadastrado/);
assert.doesNotMatch(html, /Busque qualquer pessoa cadastrada no app/);
assert.doesNotMatch(html, /placeholder="Nome ou email"/);
assert.doesNotMatch(html, /placeholder="Buscar por nome ou email"/);

assert.match(sql, /create policy "profiles approved social discovery"/);
assert.match(sql, /create policy "follows insert self"/);
assert.match(sql, /create or replace function public\.sync_coach_student_follow/);
assert.match(sql, /create trigger trg_profiles_sync_coach_student_follow/);
assert.match(sql, /insert into public\.follows \(follower_id, following_id\)\s+select p\.coach_id, p\.id/);
assert.match(sql, /create policy "feed social read"/);
assert.match(sql, /create policy "periodization days self manage"/);
assert.match(sql, /create policy "sessions self manage"/);
assert.match(sql, /create policy "setlogs self manage"/);

assert.match(socialPeopleEdge, /body\.action === "search"/);
assert.match(socialPeopleEdge, /body\.action === "follows"/);
assert.match(socialPeopleEdge, /body\.action === "profiles"/);
assert.match(socialPeopleEdge, /body\.action === "follow"/);
assert.match(socialPeopleEdge, /body\.action === "unfollow"/);
assert.match(socialPeopleEdge, /body\.action === "push_audit"/);
assert.match(socialPeopleEdge, /lookupProfiles/);
assert.match(socialPeopleEdge, /profileById/);
assert.match(socialPeopleEdge, /neq\("id", requester\.id\)/);
assert.match(socialPeopleEdge, /eq\("status", "approved"\)/);
assert.match(socialPeopleEdge, /function canDiscoverProfile\(requester: Profile, target: Profile, includeSelf = true\)/);
assert.match(socialPeopleEdge, /requester\.role === "admin"/);
assert.match(socialPeopleEdge, /requester\.role === "coach"[\s\S]*target\.coach_id === requester\.id/);
assert.match(socialPeopleEdge, /requester\.role === "student" && requester\.coach_id/);
assert.match(socialPeopleEdge, /function toPublicProfile\(profile: Profile\)/);
const publicProfileBlock = socialPeopleEdge.slice(
  socialPeopleEdge.indexOf("function toPublicProfile(profile: Profile)"),
  socialPeopleEdge.indexOf("function profileMatchesTerm")
);
assert.doesNotMatch(publicProfileBlock, /email/);
assert.match(socialPeopleEdge, /Você não tem permissão para seguir este perfil/);
assert.match(socialPeopleEdge, /onConflict: "follower_id,following_id"/);
assert.match(socialPeopleEdge, /Apenas ADM MASTER/);

assert.match(hardening, /drop policy if exists "profiles approved social discovery"/);
assert.match(hardening, /create or replace function public\.can_social_discover/);
assert.match(hardening, /create policy "profiles social scoped read"/);
assert.match(hardening, /delete from public\.follows f\s+where not public\.can_social_discover/);
assert.match(hardening, /create policy "follows insert self"[\s\S]*public\.can_social_discover\(auth\.uid\(\), following_id, false\)/);
assert.match(hardening, /create policy "feed social read"[\s\S]*public\.can_social_discover\(auth\.uid\(\), feed_posts\.student_id, true\)/);

assert.match(rpcHardening, /revoke execute on function public\.admin_update_trainer\([\s\S]*\) from public;/);
assert.match(rpcHardening, /revoke execute on function public\.can_manage_periodization_student\(uuid\) from public;/);
assert.match(rpcHardening, /revoke execute on function public\.can_social_discover\(uuid, uuid, boolean\) from public;/);
assert.match(rpcHardening, /revoke execute on function public\.ensure_coach_owns_student\(uuid\) from public;/);
assert.match(rpcHardening, /alter function public\.set_updated_at\(\) set search_path = public;/);
assert.match(rpcHardening, /alter function public\.touch_updated_at\(\) set search_path = public;/);
assert.match(anonRpcHardening, /revoke execute on function public\.can_manage_periodization_student\(uuid\) from anon;/);
assert.match(anonRpcHardening, /revoke execute on function public\.can_social_discover\(uuid, uuid, boolean\) from anon;/);
assert.match(anonRpcHardening, /revoke execute on function public\.ensure_coach_owns_student\(uuid\) from anon;/);

console.log("qa-social-feed-coach-training ok");
