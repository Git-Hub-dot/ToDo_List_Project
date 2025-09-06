(() => {
  const STORAGE_KEY = "todo.items.v1";
  const FILTER_KEY = "todo.filter.v1";

  /** @type {{id:string, title:string, done:boolean, created:number}[]} */
  let items = readStorage(STORAGE_KEY, []);
  /** @type {"all"|"active"|"completed"} */
  let filter = readStorage(FILTER_KEY, "all");
  let query = "";

  // DOM
  const form = document.getElementById("todo-form");
  const input = document.getElementById("task-input");
  const list = document.getElementById("task-list");
  const empty = document.getElementById("empty-state");
  const countActive = document.getElementById("count-active");
  const clearCompletedBtn = document.getElementById("clear-completed");
  const clearAllBtn = document.getElementById("clear-all");
  const searchInput = document.getElementById("search-input");
  const filterChips = [...document.querySelectorAll(".chip[data-filter]")];

  // Init
  setActiveFilterChip(filter);
  render();

  // Events
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = input.value.trim();
    if (!title) return;
    addItem(title);
    input.value = "";
    input.focus();
  });

  list.addEventListener("click", (e) => {
    const btn = /** @type {HTMLElement} */ (e.target.closest("[data-action]"));
    if (!btn) return;
    const id = btn.closest("li")?.dataset.id;
    if (!id) return;

    const action = btn.dataset.action;
    if (action === "toggle") {
      toggleDone(id);
    } else if (action === "delete") {
      removeItemAnimated(id);
    }
  });

  list.addEventListener("change", (e) => {
    const cb = /** @type {HTMLInputElement} */ (e.target);
    if (cb.matches(".checkbox")) {
      const id = cb.closest("li")?.dataset.id;
      if (id) toggleDone(id, cb.checked);
    }
  });

  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      setFilter(chip.dataset.filter);
    });
  });

  clearAllBtn.addEventListener("click", () => {
    if (!items.length) return;
    if (confirm("Clear ALL tasks? This cannot be undone.")) {
      items = [];
      persist();
      render();
    }
  });

  clearCompletedBtn.addEventListener("click", () => {
    if (!items.some((t) => t.done)) return;
    if (confirm("Remove all completed tasks?")) {
      items = items.filter((t) => !t.done);
      persist();
      render();
    }
  });

  searchInput.addEventListener("input", () => {
    query = searchInput.value.trim().toLowerCase();
    render();
  });

  // Keyboard: Enter to add if focused in input (handled by form)
  // Accessibility: nothing extra needed here.

  function addItem(title) {
    const item = {
      id: cryptoRandomId(),
      title,
      done: false,
      created: Date.now(),
    };
    items.unshift(item);
    persist();
    render({ justAddedId: item.id });
  }

  function toggleDone(id, forceValue) {
    const i = items.findIndex((t) => t.id === id);
    if (i === -1) return;
    items[i].done = typeof forceValue === "boolean" ? forceValue : !items[i].done;
    persist();
    render();
  }

  function removeItemAnimated(id) {
    const li = list.querySelector(`li[data-id="${id}"]`);
    if (!li) {
      removeItem(id);
      return;
    }
    li.classList.add("exit");
    li.addEventListener("animationend", () => {
      removeItem(id);
      render();
    }, { once: true });
  }

  function removeItem(id) {
    items = items.filter((t) => t.id !== id);
    persist();
  }

  function setFilter(value) {
    if (value !== "all" && value !== "active" && value !== "completed") return;
    filter = value;
    writeStorage(FILTER_KEY, filter);
    setActiveFilterChip(filter);
    render();
  }

  function currentView() {
    let list = [...items];

    if (query) {
      list = list.filter((t) => t.title.toLowerCase().includes(query));
    }

    if (filter === "active") list = list.filter((t) => !t.done);
    if (filter === "completed") list = list.filter((t) => t.done);

    return list;
  }

  function render(opts = {}) {
    const { justAddedId } = opts;

    const view = currentView();
    list.innerHTML = view
      .map(
        (t) => `
      <li class="task ${t.done ? "done" : ""}" data-id="${t.id}">
        <input class="checkbox" type="checkbox" ${t.done ? "checked" : ""} aria-label="Mark task as ${t.done ? "pending" : "completed"}">
        <div>
          <p class="task__title">${escapeHtml(t.title)}</p>
          <div class="task__meta">
            <span title="${new Date(t.created).toLocaleString()}">${timeAgo(t.created)}</span>
            ${t.done ? `<span>✓ completed</span>` : ""}
          </div>
        </div>
        <div class="task__actions">
          <button class="icon-btn icon-btn--complete" data-action="toggle" title="${t.done ? "Mark as pending" : "Mark as completed"}" aria-label="${t.done ? "Mark as pending" : "Mark as completed"}">
            <i class="fa-regular fa-square-check"></i>
          </button>
          <button class="icon-btn icon-btn--delete" data-action="delete" title="Delete task" aria-label="Delete task">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </li>`
      )
      .join("");

    // Show/hide empty state
    empty.classList.toggle("hidden", view.length !== 0);

    // Pending count
    const remaining = items.filter((t) => !t.done).length;
    countActive.textContent = String(remaining);

    // If a task was just added, ensure it’s visible and highlighted by focusing its checkbox
    if (justAddedId) {
      const el = list.querySelector(`li[data-id="${justAddedId}"] .checkbox`);
      if (el) el.focus();
    }
  }

  /* -------------------- Utilities -------------------- */

  function readStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function persist() {
    writeStorage(STORAGE_KEY, items);
  }

  function cryptoRandomId() {
    // Prefer crypto if available; fallback to Math.random
    if (window.crypto?.getRandomValues) {
      const arr = new Uint32Array(2);
      window.crypto.getRandomValues(arr);
      return [...arr].map((n) => n.toString(16)).join("");
    }
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function escapeHtml(str) {
    return str
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return d === 1 ? "1 day ago" : `${d} days ago`;
    if (h > 0) return h === 1 ? "1 hour ago" : `${h} hours ago`;
    if (m > 0) return m === 1 ? "1 minute ago" : `${m} minutes ago`;
    return s <= 5 ? "just now" : `${s} seconds ago`;
  }

  function setActiveFilterChip(val) {
    filterChips.forEach((chip) => {
      const active = chip.dataset.filter === val;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-selected", String(active));
    });
  }
})();
