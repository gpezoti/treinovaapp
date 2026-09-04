import { test, expect } from "@playwright/test";

test("treinador pode ocultar e reexibir o checklist da tela inicial", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(() => {
    localStorage.clear();
    eval("sb = null");

    const state = eval("STATE");
    state.profile = {
      id: "coach-checklist-test",
      role: "coach",
      status: "approved",
      full_name: "Treinador de teste"
    };
    state.students = [];
    state.workouts = {};
    state.branding = {};
    state.paymentAccounts = [];
    state.view = "checklist-test";

    const renderChecklist = eval("renderCoachOnboardingChecklist");
    const slot = document.createElement("div");
    document.body.appendChild(slot);
    slot.innerHTML = renderChecklist();

    const dismiss = slot.querySelector('[data-testid="dismiss-coach-onboarding-checklist"]');
    const visibleBeforeDismiss = Boolean(dismiss);
    dismiss?.click();

    const storageKey = "treinova_coach_setup_checklist_dismissed_v1_coach-checklist-test";
    const hiddenAfterDismiss = renderChecklist() === "";
    const persisted = localStorage.getItem(storageKey) === "1";

    window.restoreCoachOnboardingChecklist();
    const visibleAfterRestore = renderChecklist().includes("Configure seu app");
    const clearedAfterRestore = localStorage.getItem(storageKey) === null;
    slot.remove();

    return { visibleBeforeDismiss, hiddenAfterDismiss, persisted, visibleAfterRestore, clearedAfterRestore };
  });

  expect(result).toEqual({
    visibleBeforeDismiss: true,
    hiddenAfterDismiss: true,
    persisted: true,
    visibleAfterRestore: true,
    clearedAfterRestore: true
  });
});
