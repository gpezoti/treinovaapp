// supabase/functions/social-people/index.ts
//
// Busca social autenticada para o Feed.
// A Edge Function usa service role, entao o isolamento white-label precisa ficar aqui
// e nao apenas em RLS/frontend.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROFILE_SELECT = "id,email,full_name,avatar_emoji,avatar_url,role,status,coach_id";

type Profile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_emoji?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  status?: string | null;
  coach_id?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await sbUser.auth.getUser();
  return user || null;
}

async function getRequester(req: Request): Promise<Profile | Response> {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: "Não autenticado." }, 401);

  const { data, error } = await sbAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!data || data.status !== "approved") return json({ error: "Perfil não aprovado." }, 403);
  return data as Profile;
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function normalizeQuery(value: unknown) {
  return String(value || "")
    .replace(/[%,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function isApproved(profile: Profile | null | undefined) {
  return profile?.status === "approved";
}

function canDiscoverProfile(requester: Profile, target: Profile, includeSelf = true) {
  if (!isApproved(requester) || !isApproved(target)) return false;
  if (requester.id === target.id) return includeSelf;
  if (requester.role === "admin") return true;
  if (target.role === "admin") return true;

  if (requester.role === "coach") {
    return target.role === "student" && target.coach_id === requester.id;
  }

  if (requester.role === "student" && requester.coach_id) {
    return target.id === requester.coach_id
      || (target.role === "student" && target.coach_id === requester.coach_id);
  }

  return false;
}

function publicName(profile: Profile) {
  const name = String(profile.full_name || "").trim();
  return name || (profile.role === "coach" ? "Treinador" : profile.role === "admin" ? "Suporte" : "Aluno");
}

function toPublicProfile(profile: Profile) {
  return {
    id: profile.id,
    full_name: publicName(profile),
    avatar_emoji: profile.avatar_emoji || null,
    avatar_url: profile.avatar_url || null,
    role: profile.role || "student",
  };
}

function profileMatchesTerm(profile: Profile, term: string, requester: Profile) {
  const lower = term.toLowerCase();
  const nameMatches = String(profile.full_name || "").toLowerCase().includes(lower);
  if (nameMatches) return true;
  // Email so pode ser usado como campo de busca global pelo ADM MASTER.
  return requester.role === "admin" && String(profile.email || "").toLowerCase().includes(lower);
}

async function loadProfiles(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 120);
  if (!uniqueIds.length) return new Map<string, Profile>();

  const { data, error } = await sbAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .in("id", uniqueIds)
    .eq("status", "approved");

  if (error) throw error;
  return new Map((data || []).map((p: Profile) => [p.id, p]));
}

async function searchPeople(req: Request, body: any) {
  const requester = await getRequester(req);
  if (isResponse(requester)) return requester;

  const term = normalizeQuery(body?.query);
  if (term.length < 2) return json({ ok: true, people: [] });

  let query = sbAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .neq("id", requester.id)
    .eq("status", "approved")
    .order("full_name", { ascending: true })
    .limit(requester.role === "admin" ? 60 : 120);

  if (requester.role === "admin") {
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  } else if (requester.role === "coach") {
    query = query.or(`role.eq.admin,coach_id.eq.${requester.id}`).ilike("full_name", `%${term}%`);
  } else if (requester.role === "student" && requester.coach_id) {
    query = query.or(`role.eq.admin,id.eq.${requester.coach_id},coach_id.eq.${requester.coach_id}`).ilike("full_name", `%${term}%`);
  } else {
    query = query.eq("role", "admin").ilike("full_name", `%${term}%`);
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const people = (data || [])
    .filter((p: Profile) => canDiscoverProfile(requester, p, false))
    .filter((p: Profile) => profileMatchesTerm(p, term, requester))
    .slice(0, 40)
    .map(toPublicProfile);

  return json({ ok: true, people });
}

async function getFollows(req: Request) {
  const requester = await getRequester(req);
  if (isResponse(requester)) return requester;

  const { data, error } = await sbAdmin
    .from("follows")
    .select("follower_id,following_id")
    .or(`follower_id.eq.${requester.id},following_id.eq.${requester.id}`);

  if (error) return json({ error: error.message }, 500);

  const ids = Array.from(new Set((data || []).flatMap((f: any) => [f.follower_id, f.following_id]).filter(Boolean)));
  let profileById = new Map<string, Profile>();
  try {
    profileById = await loadProfiles(ids);
  } catch (profilesError) {
    return json({ error: profilesError instanceof Error ? profilesError.message : String(profilesError) }, 500);
  }

  const following = (data || [])
    .filter((f: any) => f.follower_id === requester.id)
    .map((f: any) => {
      const profile = profileById.get(f.following_id);
      if (!profile || !canDiscoverProfile(requester, profile, false)) return null;
      return { following_id: f.following_id, profile: toPublicProfile(profile) };
    })
    .filter(Boolean);

  const followers = (data || [])
    .filter((f: any) => f.following_id === requester.id)
    .map((f: any) => {
      const profile = profileById.get(f.follower_id);
      if (!profile || !canDiscoverProfile(requester, profile, false)) return null;
      return { follower_id: f.follower_id, profile: toPublicProfile(profile) };
    })
    .filter(Boolean);

  return json({ ok: true, following, followers });
}

async function lookupProfiles(req: Request, body: any) {
  const requester = await getRequester(req);
  if (isResponse(requester)) return requester;

  const ids = Array.from(new Set((Array.isArray(body?.ids) ? body.ids : [])
    .map((id: unknown) => String(id || "").trim())
    .filter(Boolean)))
    .slice(0, 80);
  if (!ids.length) return json({ ok: true, people: [] });

  try {
    const profileById = await loadProfiles(ids);
    const people = ids
      .map((id) => profileById.get(id))
      .filter((p): p is Profile => Boolean(p && canDiscoverProfile(requester, p, true)))
      .map(toPublicProfile);

    return json({ ok: true, people });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}

async function followPerson(req: Request, body: any) {
  const requester = await getRequester(req);
  if (isResponse(requester)) return requester;

  const targetId = String(body?.user_id || "");
  if (!targetId || targetId === requester.id) return json({ error: "Usuário inválido." }, 400);

  const { data: target, error: targetError } = await sbAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", targetId)
    .maybeSingle();

  if (targetError) return json({ error: targetError.message }, 500);
  if (!target || target.status !== "approved") return json({ error: "Perfil não encontrado." }, 404);
  if (!canDiscoverProfile(requester, target as Profile, false)) {
    return json({ error: "Você não tem permissão para seguir este perfil." }, 403);
  }

  const { error } = await sbAdmin
    .from("follows")
    .upsert({ follower_id: requester.id, following_id: targetId }, { onConflict: "follower_id,following_id", ignoreDuplicates: true });

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function unfollowPerson(req: Request, body: any) {
  const requester = await getRequester(req);
  if (isResponse(requester)) return requester;

  const targetId = String(body?.user_id || "");
  if (!targetId) return json({ error: "Usuário inválido." }, 400);

  const { error } = await sbAdmin
    .from("follows")
    .delete()
    .eq("follower_id", requester.id)
    .eq("following_id", targetId);

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function pushAudit(req: Request) {
  const requester = await getRequester(req);
  if (isResponse(requester)) return requester;

  if (requester.role !== "admin") {
    return json({ error: "Apenas ADM MASTER pode ver o diagnóstico global." }, 403);
  }

  const { data: profiles, error: profilesError } = await sbAdmin
    .from("profiles")
    .select("id,full_name,email,role,status")
    .eq("status", "approved");
  if (profilesError) return json({ error: profilesError.message }, 500);

  const { data: subs, error: subsError } = await sbAdmin
    .from("push_subscriptions")
    .select("user_id,last_seen_at,endpoint")
    .order("last_seen_at", { ascending: false });
  if (subsError) return json({ error: subsError.message }, 500);

  const usersWithSub = new Set((subs || []).map((s: any) => s.user_id).filter(Boolean));
  const missing = (profiles || [])
    .filter((p: any) => !usersWithSub.has(p.id))
    .map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      role: p.role,
    }))
    .slice(0, 50);

  return json({
    ok: true,
    approved_users: profiles?.length || 0,
    push_subscriptions: subs?.length || 0,
    users_with_subscription: usersWithSub.size,
    users_without_subscription: Math.max(0, (profiles?.length || 0) - usersWithSub.size),
    missing,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  if (body.action === "search") return searchPeople(req, body);
  if (body.action === "follows") return getFollows(req);
  if (body.action === "profiles") return lookupProfiles(req, body);
  if (body.action === "follow") return followPerson(req, body);
  if (body.action === "unfollow") return unfollowPerson(req, body);
  if (body.action === "push_audit") return pushAudit(req);

  return json({ error: "Ação inválida." }, 400);
});
