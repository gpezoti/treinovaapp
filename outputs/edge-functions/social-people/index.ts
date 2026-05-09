// supabase/functions/social-people/index.ts
//
// Busca social autenticada para o Feed.
// Mantem a regra no backend para nao depender de policies complexas de profiles no client.

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

function normalizeQuery(value: unknown) {
  return String(value || "")
    .replace(/[%,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

async function searchPeople(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: "Não autenticado." }, 401);

  const term = normalizeQuery(body?.query);
  if (term.length < 2) return json({ ok: true, people: [] });

  const { data, error } = await sbAdmin
    .from("profiles")
    .select("id,email,full_name,avatar_emoji,avatar_url,role")
    .neq("id", user.id)
    .eq("status", "approved")
    .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
    .order("full_name", { ascending: true })
    .limit(40);

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, people: data || [] });
}

async function getFollows(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: "Não autenticado." }, 401);

  const { data, error } = await sbAdmin
    .from("follows")
    .select("follower_id,following_id")
    .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);

  if (error) return json({ error: error.message }, 500);
  return json({
    ok: true,
    following: (data || []).filter((f: any) => f.follower_id === user.id).map((f: any) => ({ following_id: f.following_id })),
    followers: (data || []).filter((f: any) => f.following_id === user.id).map((f: any) => ({ follower_id: f.follower_id })),
  });
}

async function followPerson(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: "Não autenticado." }, 401);

  const targetId = String(body?.user_id || "");
  if (!targetId || targetId === user.id) return json({ error: "Usuário inválido." }, 400);

  const { data: target, error: targetError } = await sbAdmin
    .from("profiles")
    .select("id,status")
    .eq("id", targetId)
    .maybeSingle();

  if (targetError) return json({ error: targetError.message }, 500);
  if (!target || target.status !== "approved") return json({ error: "Perfil não encontrado." }, 404);

  const { error } = await sbAdmin
    .from("follows")
    .upsert({ follower_id: user.id, following_id: targetId }, { onConflict: "follower_id,following_id", ignoreDuplicates: true });

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function unfollowPerson(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: "Não autenticado." }, 401);

  const targetId = String(body?.user_id || "");
  if (!targetId) return json({ error: "Usuário inválido." }, 400);

  const { error } = await sbAdmin
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", targetId);

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function pushAudit(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: "Não autenticado." }, 401);

  const { data: requester, error: requesterError } = await sbAdmin
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (requesterError) return json({ error: requesterError.message }, 500);
  if (requester?.role !== "admin" || requester?.status !== "approved") {
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
  if (body.action === "follow") return followPerson(req, body);
  if (body.action === "unfollow") return unfollowPerson(req, body);
  if (body.action === "push_audit") return pushAudit(req);

  return json({ error: "Ação inválida." }, 400);
});
