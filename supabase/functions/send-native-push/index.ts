// supabase/functions/send-native-push/index.ts
//
// Envia push remoto nativo iOS via APNs.
// Autorização:
// - admin pode enviar para qualquer usuário
// - coach pode enviar para seus alunos
// - student pode enviar para seu coach
//
// Secrets necessários:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SUPABASE_ANON_KEY
//   APNS_KEY_ID
//   APNS_TEAM_ID
//   APNS_BUNDLE_ID
//   APNS_PRIVATE_KEY  (conteúdo do .p8, com quebras reais ou \n)
//   APNS_ENV          production ou sandbox

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID")!;
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID")!;
const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") || "br.com.treinova.app";
const APNS_PRIVATE_KEY = Deno.env.get("APNS_PRIVATE_KEY") || "";
const APNS_ENV = Deno.env.get("APNS_ENV") || "production";

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

function b64url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToDer(pem: string) {
  const clean = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  return Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
}

async function createApnsJwt() {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }));
  const claims = b64url(JSON.stringify({ iss: APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }));
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(APNS_PRIVATE_KEY),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned),
  ));
  return `${unsigned}.${b64url(signature)}`;
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

async function allowedRecipients(caller: any, userIds: string[]) {
  if (caller.role === "admin") return userIds;

  if (caller.role === "coach") {
    const { data } = await sbAdmin
      .from("profiles")
      .select("id")
      .eq("coach_id", caller.id)
      .in("id", userIds);
    return (data || []).map((row: any) => row.id);
  }

  if (caller.role === "student" && caller.coach_id) {
    return userIds.filter((id) => id === caller.coach_id);
  }

  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: "Não autenticado." }, 401);

  const { data: caller, error: callerErr } = await sbAdmin
    .from("profiles")
    .select("id, role, coach_id, status")
    .eq("id", user.id)
    .single();

  if (callerErr || !caller) return json({ error: "Perfil não encontrado." }, 403);
  if (caller.status !== "approved") return json({ error: "Conta não aprovada." }, 403);

  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) {
    return json({ error: "APNs não configurado." }, 500);
  }

  try {
    const { user_ids, title, body, url, chat, tag } = await req.json();
    if (!Array.isArray(user_ids) || !user_ids.length) {
      return json({ error: "user_ids deve ser um array não vazio." }, 400);
    }

    const allowedIds = await allowedRecipients(caller, user_ids);
    if (!allowedIds.length) return json({ ok: true, sent: 0, reason: "Sem destinatários permitidos." });

    const { data: tokens } = await sbAdmin
      .from("native_push_tokens")
      .select("token,user_id")
      .in("user_id", allowedIds);

    if (!tokens?.length) return json({ ok: true, sent: 0, reason: "Nenhum token nativo encontrado." });

    const jwt = await createApnsJwt();
    const host = APNS_ENV === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
    let sent = 0;
    let failed = 0;

    for (const row of tokens) {
      const payload = {
        aps: {
          alert: { title: title || "Treinova", body: body || "" },
          sound: "default",
          badge: 1,
        },
        url: url || "/",
        chat: chat || undefined,
        tag: tag || undefined,
      };

      const response = await fetch(`https://${host}/3/device/${row.token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": APNS_BUNDLE_ID,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        sent++;
      } else {
        failed++;
        const text = await response.text();
        if ([400, 410].includes(response.status) && /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(text)) {
          await sbAdmin.from("native_push_tokens").delete().eq("token", row.token);
        } else {
          console.error("[send-native-push] APNs error", response.status, text);
        }
      }
    }

    return json({ ok: true, sent, failed });
  } catch (e: any) {
    console.error("[send-native-push]", e);
    return json({ error: e.message || String(e) }, 500);
  }
});
