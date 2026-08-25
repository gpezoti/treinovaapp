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
