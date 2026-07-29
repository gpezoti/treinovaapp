import { test, expect } from "@playwright/test";

async function seedAgenda(page) {
  await page.goto("/");
  await page.evaluate(() => {
    const state = eval("STATE");

    const workoutA = {
      id: "workout-a",
      code: "A",
      name: "Treino A",
      focus: "Peito",
      exercises: [{ id: "exercise-a", name: "Supino reto", position: 1, muscle_group: "Peito" }]
    };
    const workoutB = {
      id: "workout-b",
      code: "B",
      name: "Treino B",
      focus: "Costas",
      exercises: [{ id: "exercise-b", name: "Remada baixa", position: 1, muscle_group: "Costas" }]
    };

    state.profile = { id: "student-test", role: "student", status: "active", name: "Aluno teste" };
    state.platformAccess = { locked: false };
    state.myPaymentBlocked = false;
    const offDays = ["2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14"].map((date, index) => ({
      id: `day-off-${index}`,
      date,
      intensity: "off",
      preset_code: "off",
      workout_code: "OFF",
      workout_id: null,
      blocks: []
    }));
    state.periodization = [
      {
        id: "day-a",
        date: "2026-06-08",
        intensity: "yellow",
        preset_code: "hipertrofia",
        workout_code: "A",
        workout_id: "workout-a",
        blocks: [{ position: 0, preset_code: "hipertrofia", workout_code: "A", workout_id: "workout-a" }]
      },
      {
        id: "day-b",
        date: "2026-06-09",
        intensity: "yellow",
        preset_code: "hipertrofia",
        workout_code: "A",
        workout_id: "workout-a",
        blocks: [
          { position: 0, preset_code: "hipertrofia", workout_code: "A", workout_id: "workout-a" },
          { position: 1, preset_code: "hipertrofia", workout_code: "B", workout_id: "workout-b" }
        ]
      },
      ...offDays
    ];
    state.workouts = { A: workoutA, B: workoutB };
    state.workoutsById = { "workout-a": workoutA, "workout-b": workoutB };
    // Sessao C representa uma troca de treino feita pelo aluno neste mesmo dia.
    // A Agenda deve considerar o dia concluido mesmo sem ser o codigo originalmente planejado.
    state.calendarSessionsByDate = {
      "2026-06-08": [{ id: "completed-c", date: "2026-06-08", workout_code: "C", status: "completed" }],
      "2026-06-09": [{ id: "completed-c-with-cardio", date: "2026-06-09", workout_code: "C", status: "completed" }]
    };
    state.calendarAeroDates = new Set();
    state.calendarProgressLoaded = true;
    state.todaySessions = [{
      id: "session-a",
      date: "2026-06-08",
      workout_code: "A",
      workout_id: "workout-a",
      status: "completed"
    }];
    state.currentSession = state.todaySessions[0];
    state.setLogs = [{ id: "set-a", exercise_position: 1, set_number: 1, done: true }];
    state.view = "calendar";
    state.agendaWorkoutTarget = null;
    document.getElementById("auth-page")?.style.setProperty("display", "none");
    document.getElementById("app")?.style.setProperty("display", "block");
    document.getElementById("app-skeleton")?.remove();
    document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
    document.getElementById("view-calendar")?.classList.add("active");
    eval("renderCalendar()");
  });
}

test("Agenda abre treino de outro dia e reconhece treino trocado como concluido", async ({ page }) => {
  await seedAgenda(page);

  const otherDay = page.locator('[data-agenda-day="2026-06-08"]');
  await expect(otherDay).toHaveClass(/is-done/);
  await otherDay.click();

  await expect.poll(() => page.evaluate(() => eval("STATE.view"))).toBe("workout");
  await expect.poll(() => page.evaluate(() => eval("STATE.selectedDate"))).toBe("2026-06-08");
  await expect.poll(() => page.evaluate(() => eval("STATE.selectedWorkout"))).toBe("A");
});

test("Agenda permite escolher qualquer atividade quando o dia tem mais de um treino", async ({ page }) => {
  await seedAgenda(page);

  const mixedDay = page.locator('[data-agenda-day="2026-06-09"]');
  await expect(mixedDay).toHaveClass(/is-done/);
  await mixedDay.click();
  const secondActivity = page.locator('[data-agenda-block-date="2026-06-09"][data-agenda-block-index="1"]');
  await expect(secondActivity).toBeVisible();
  await secondActivity.click();

  await expect.poll(() => page.evaluate(() => eval("STATE.view"))).toBe("workout");
  await expect.poll(() => page.evaluate(() => eval("STATE.selectedDate"))).toBe("2026-06-09");
  await expect.poll(() => page.evaluate(() => eval("STATE.selectedWorkout"))).toBe("B");
});
