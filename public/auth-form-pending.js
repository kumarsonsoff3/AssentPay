// This small enhancement runs before React. Authentication still works through
// native POST if hydration is delayed; never disable the credential inputs.
(() => {
  const pending = new Map();

  const isAuthForm = (form) =>
    form instanceof HTMLFormElement && form.hasAttribute("data-auth-pending");

  // Stop a repeated native submission before it can reach a newly hydrated
  // React handler while the first navigation is still in progress.
  window.addEventListener("submit", (event) => {
    if (isAuthForm(event.target) && pending.has(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  // React handles its submissions on the document first. Only enhance events
  // that it has not intercepted, leaving client validation and state intact.
  window.addEventListener("submit", (event) => {
    const form = event.target;
    if (event.defaultPrevented || !isAuthForm(form)) return;
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    pending.set(form, {
      button,
      children: Array.from(button.childNodes),
      disabled: button.disabled,
      busy: form.getAttribute("aria-busy"),
      live: button.getAttribute("aria-live"),
    });
    button.textContent = form.getAttribute("data-auth-pending");
    button.disabled = true;
    button.setAttribute("aria-live", "polite");
    form.setAttribute("aria-busy", "true");
  });

  // Safari can restore a submitted page from its back/forward cache. It must
  // return with an enabled button rather than a permanently pending form.
  window.addEventListener("pageshow", () => {
    for (const [form, state] of pending) {
      state.button.replaceChildren(...state.children);
      state.button.disabled = state.disabled;
      if (state.live === null) state.button.removeAttribute("aria-live");
      else state.button.setAttribute("aria-live", state.live);
      if (state.busy === null) form.removeAttribute("aria-busy");
      else form.setAttribute("aria-busy", state.busy);
    }
    pending.clear();
  });
})();
