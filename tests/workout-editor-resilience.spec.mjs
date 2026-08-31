import { test, expect } from "@playwright/test";

function workoutRows(order = ["exercise-a", "exercise-b"]) {
  return order.map((id, index) => ({
    id,
    name: id === "exercise-a" ? "Supino" : "Remada",
    position: index,
    muscle_group: "Peito",
    sets_count: 3,
    reps: "8-12",
  }));
}

test("ordena exercícios com uma única RPC atômica", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async (exercises) => {
    const state = eval("STATE");
    state.user = { id: "coach-editor-test" };
    state.profile = { id: "coach-editor-test", role: "coach" };
    state.workouts = { A: { id: "workout-editor-test", code: "A", exercises } };
    state.workoutsById = { "workout-editor-test": state.workouts.A };
    state._editingWorkout = { id: "workout-editor-test", code: "A", name: "Treino A", exercises };
    const rpcCalls = [];
    eval(`sb = {
      rpc(name, payload) { rpcCalls.push({ name, payload }); return Promise.resolve({ error: null }); },
      functions: { invoke() { return Promise.resolve({ error: null }); } }
    }`);

    await eval("moveExerciseInWorkout")("exercise-b", "A", "workout-editor-test", -1);
    return {
      rpcCalls,
      renderedOrder: state._editingWorkout.exercises.map((exercise) => exercise.id),
    };
  }, workoutRows());

  expect(result.renderedOrder).toEqual(["exercise-b", "exercise-a"]);
  expect(result.rpcCalls).toEqual([{
    name: "reorder_workout_exercises",
    payload: {
      p_workout_id: "workout-editor-test",
      p_exercise_ids: ["exercise-b", "exercise-a"],
    },
  }]);
});

test("falha de ordenação recarrega a lista sem abrir um loading infinito", async ({ page }) => {
  await page.goto("/");
  const initialExercises = workoutRows();
  const persistedExercises = workoutRows(["exercise-a", "exercise-b"]);
  const result = await page.evaluate(async ({ exercises, serverExercises }) => {
    const state = eval("STATE");
    state.user = { id: "coach-editor-failure" };
    state.profile = { id: "coach-editor-failure", role: "coach" };
    state.workouts = { A: { id: "workout-editor-failure", code: "A", exercises } };
    state.workoutsById = { "workout-editor-failure": state.workouts.A };
    state._editingWorkout = { id: "workout-editor-failure", code: "A", name: "Treino A", exercises };
    eval("openSheet")('<h3>Editar Treino A</h3><div id="we-ex-list"></div>');
    const rpcCalls = [];
    eval(`sb = {
      rpc(name, payload) { rpcCalls.push({ name, payload }); return Promise.resolve({ error: new Error("network unavailable") }); },
      from(table) {
        if (table === "workouts") {
          return { select() { return { eq() { return { single() { return Promise.resolve({ data: { id: "workout-editor-failure", code: "A", name: "Treino A" }, error: null }); } }; } }; } };
        }
        if (table === "exercises") {
          return { select() { return { eq() { return { order() { return Promise.resolve({ data: serverExercises, error: null }); } }; } }; } };
        }
        throw new Error("Tabela inesperada: " + table);
      },
      functions: { invoke() { return Promise.resolve({ error: null }); } }
    }`);

    await eval("moveExerciseInWorkout")("exercise-b", "A", "workout-editor-failure", -1);
    return {
      rpcCalls,
      sheetText: document.getElementById("sheet-content")?.textContent || "",
      orderAfterRecovery: state._editingWorkout.exercises.map((exercise) => exercise.id),
    };
  }, { exercises: initialExercises, serverExercises: persistedExercises });

  expect(result.rpcCalls).toHaveLength(1);
  expect(result.sheetText).not.toContain("Carregando treino");
  expect(result.orderAfterRecovery).toEqual(["exercise-a", "exercise-b"]);
});
