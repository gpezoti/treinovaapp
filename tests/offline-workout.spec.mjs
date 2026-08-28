import { test, expect } from "@playwright/test";

test("aluno inicia e registra uma série sem conexão", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    const state = eval("STATE");
    state.user = { id: "student-offline-test" };
    state.profile = { id: "student-offline-test", role: "student", status: "active" };
    state.workouts = {
      A: {
        id: "workout-offline-a",
        code: "A",
        name: "Treino offline",
        exercises: [{ id: "exercise-offline-a", name: "Supino", cat: "chest", position: 1 }]
      }
    };
    state.workoutsById = { "workout-offline-a": state.workouts.A };
    state.lastLoads = {};
    state.setLogs = [];
    state.currentSession = null;
    state._offlineWorkoutSync = null;
    localStorage.removeItem("treinova_student_offline_workout_v1:student-offline-test");

    const session = await eval("loadOrCreateSession")("2026-08-25", "A", "yellow", "workout-offline-a");
    const exercise = state.workouts.A.exercises[0];
    const log = await eval("ensureSetLog")(exercise, 1, 1);
    await eval("updateSetLog")(log.id, { done: true, done_at: "2026-08-25T10:00:00.000Z", load_kg: 40 });

    const saved = JSON.parse(localStorage.getItem("treinova_student_offline_workout_v1:student-offline-test"));
    const calls = [];
    const response = { error: null };
    const updateChain = {
      eq() { return this; },
      neq() { return response; }
    };
    eval("sb = { from(table) { return table === 'sessions' ? { update(payload) { calls.push({ type: 'abandon', payload }); return updateChain; }, upsert(row) { calls.push({ type: 'session', row }); return response; } } : { upsert(rows) { calls.push({ type: 'logs', rows }); return response; }, delete() { return updateChain; } }; } }");
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
    const synced = await eval("flushOfflineWorkoutSync")("playwright");

    return {
      localSession: session?.id,
      logDone: state.setLogs[0]?.done,
      queuedSession: saved?.pending_session?.row?.id,
      queuedLog: saved?.set_log_ops?.find(op => op.id === log.id)?.row?.load_kg,
      synced,
      callTypes: calls.map(call => call.type)
    };
  });

  expect(result.localSession).toMatch(/^[0-9a-f-]{36}$/i);
  expect(result.logDone).toBe(true);
  expect(result.queuedSession).toBe(result.localSession);
  expect(result.queuedLog).toBe(40);
  expect(result.synced).toBe(true);
  expect(result.callTypes).toEqual(["abandon", "session", "logs"]);
});

test("aluno reabre o planejamento salvo sem consultar o perfil quando está offline", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    const state = eval("STATE");
    const studentId = "student-offline-profile";
    state.user = { id: studentId };
    state.profile = null;
    state.workouts = {};
    state.workoutsById = {};
    localStorage.setItem(`treinova_student_offline_bundle_v1:${studentId}`, JSON.stringify({
      version: 1,
      user_id: studentId,
      profile: { id: studentId, role: "student", status: "active", full_name: "Aluno offline" },
      workouts: [{ id: "workout-offline-profile", code: "A", name: "Treino salvo", exercises: [] }],
      workout_refs: { A: "workout-offline-profile" },
      periodization: [],
      day_blocks: {}
    }));
    eval("sb = { from() { throw new Error('A consulta remota não deveria acontecer offline'); } }");

    const profile = await eval("loadProfile")();
    return {
      profileId: profile?.id,
      role: profile?.role,
      workoutName: state.workouts?.A?.name
    };
  });

  expect(result).toEqual({
    profileId: "student-offline-profile",
    role: "student",
    workoutName: "Treino salvo"
  });
});

test("sincronização pendente é repetida após indisponibilidade temporária", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
    const state = eval("STATE");
    state.user = { id: "student-offline-retry" };
    state.profile = { id: "student-offline-retry", role: "student", status: "active" };
    state.currentSession = null;
    state._offlineWorkoutSync = {
      pending_session: {
        revision: "session-retry-1",
        row: {
          id: "11111111-1111-4111-8111-111111111111",
          student_id: "student-offline-retry",
          date: "2026-08-25",
          workout_code: "A",
          workout_id: "workout-a",
          intensity: "yellow",
          status: "in_progress"
        }
      },
      set_log_ops: [],
      last_error: null
    };

    let sessionUpserts = 0;
    const success = { error: null };
    const updateChain = { eq() { return this; }, neq() { return success; } };
    eval(`sb = {
      from(table) {
        if (table !== "sessions") throw new Error("Tabela inesperada");
        return {
          update() { return updateChain; },
          upsert() {
            sessionUpserts += 1;
            return { error: sessionUpserts === 1 ? new Error("network unavailable") : null };
          }
        };
      }
    }`);

    const firstAttempt = await eval("flushOfflineWorkoutSync")("playwright-retry");
    await new Promise(resolve => setTimeout(resolve, 1250));
    return {
      firstAttempt,
      sessionUpserts,
      pending: !!state._offlineWorkoutSync.pending_session,
      retryAttempt: eval("_offlineWorkoutRetryAttempt")
    };
  });

  expect(result.firstAttempt).toBe(false);
  expect(result.sessionUpserts).toBe(2);
  expect(result.pending).toBe(false);
  expect(result.retryAttempt).toBe(0);
});
