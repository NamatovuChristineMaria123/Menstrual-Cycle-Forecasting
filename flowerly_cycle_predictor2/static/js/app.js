// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  viewYear:   new Date().getFullYear(),
  viewMonth:  new Date().getMonth(),
  phaseMap:   {},
  lastResult: null,
  settings:   {},
  trendChart: null,
};

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  renderCalendar();
  await loadSettings();
  await loadHistory();

  document.getElementById("cal-prev").addEventListener("click", () => {
    if (--state.viewMonth < 0) { state.viewMonth = 11; state.viewYear--; }
    renderCalendar();
  });
  document.getElementById("cal-next").addEventListener("click", () => {
    if (++state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; }
    renderCalendar();
  });
  document.getElementById("cal-today").addEventListener("click", () => {
    const n = new Date();
    state.viewYear = n.getFullYear(); state.viewMonth = n.getMonth();
    renderCalendar();
  });
  document.getElementById("clear-history-btn").addEventListener("click", clearHistory);

  // Settings modal
  document.getElementById("open-settings").addEventListener("click", () => {
    document.getElementById("settings-modal").classList.add("open");
  });
  document.getElementById("close-settings").addEventListener("click", () => {
    document.getElementById("settings-modal").classList.remove("open");
  });
  document.getElementById("settings-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove("open");
  });
  document.getElementById("save-settings").addEventListener("click", saveSettings);
});

// ── Settings ──────────────────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const res  = await fetch("/settings");
    const data = await res.json();
    if (!data.success) return;
    state.settings = data.settings;

    // Apply to modal fields
    if (data.settings.name)      document.getElementById("set-name").value      = data.settings.name;
    if (data.settings.menses)    document.getElementById("set-menses").value    = data.settings.menses;
    if (data.settings.luteal)    document.getElementById("set-luteal").value    = data.settings.luteal;
    if (data.settings.ovulation) document.getElementById("set-ovulation").value = data.settings.ovulation;

    // Pre-fill advanced inputs
    if (data.settings.menses)    document.getElementById("menses_length").value  = data.settings.menses;
    if (data.settings.luteal)    document.getElementById("luteal_phase").value   = data.settings.luteal;
    if (data.settings.ovulation) document.getElementById("ovulation_day").value  = data.settings.ovulation;

    // Welcome message
    if (data.settings.name) {
      const row = document.getElementById("welcome-row");
      document.getElementById("welcome-text").textContent = `Welcome back, ${data.settings.name}! 🌸`;
      row.style.display = "flex";
    }
  } catch(_) {}
}

async function saveSettings() {
  const payload = {
    name:      document.getElementById("set-name").value.trim(),
    menses:    document.getElementById("set-menses").value,
    luteal:    document.getElementById("set-luteal").value,
    ovulation: document.getElementById("set-ovulation").value,
  };
  try {
    await fetch("/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.settings = payload;
    // Apply pre-fills
    if (payload.menses)    document.getElementById("menses_length").value  = payload.menses;
    if (payload.luteal)    document.getElementById("luteal_phase").value   = payload.luteal;
    if (payload.ovulation) document.getElementById("ovulation_day").value  = payload.ovulation;
    // Welcome message
    if (payload.name) {
      document.getElementById("welcome-text").textContent = `Welcome back, ${payload.name}! 🌸`;
      document.getElementById("welcome-row").style.display = "flex";
    }
    document.getElementById("settings-modal").classList.remove("open");
  } catch(_) { alert("Could not save settings."); }
}

// ── Predict ───────────────────────────────────────────────────────────────────
document.getElementById("predict-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("predict-btn");
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Predicting…';
  btn.classList.add("loading"); btn.disabled = true;

  const payload = {
    cycle1:          document.getElementById("cycle1").value,
    cycle2:          document.getElementById("cycle2").value,
    cycle3:          document.getElementById("cycle3").value,
    ovulation_day:   document.getElementById("ovulation_day").value   || 15.9,
    luteal_phase:    document.getElementById("luteal_phase").value    || 13.0,
    first_high:      document.getElementById("first_high").value      || 10.0,
    fertility_score: document.getElementById("fertility_score").value || 5.0,
    menses_length:   document.getElementById("menses_length").value   || 5.0,
  };

  try {
    const res  = await fetch("/predict", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.success) { alert("Error: " + data.error); return; }
    state.lastResult = { data, payload };
    applyResults(data, payload);
    await loadHistory();
  } catch(err) {
    alert("Cannot reach server. Make sure app.py is running.");
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Predict My Cycle';
    btn.classList.remove("loading"); btn.disabled = false;
  }
});

// ── Apply results ─────────────────────────────────────────────────────────────
function applyResults(data, payload) {
  const mensesEnd = parseInt(payload.menses_length) || 5;
  const today = new Date(); today.setHours(0,0,0,0);

  document.getElementById("placeholder-card").style.display = "none";
  const panel = document.getElementById("results-panel");
  panel.style.display = "flex";

  document.getElementById("res-length").textContent = data.predicted_length;

  if (data.pcos_flag === 1) {
    document.getElementById("res-pcos-flag").style.display = "inline-flex";
    document.getElementById("res-pcos-ok").style.display   = "none";
    document.getElementById("pcos-detail-flag").style.display = "block";
    document.getElementById("pcos-detail-ok").style.display  = "none";
    document.getElementById("pcos-detail-text").textContent =
      "Risk probability: " + data.pcos_probability + "%. Your cycle falls outside the normal 21–35 day range.";
  } else {
    document.getElementById("res-pcos-ok").style.display   = "inline-flex";
    document.getElementById("res-pcos-flag").style.display = "none";
    document.getElementById("pcos-detail-ok").style.display  = "block";
    document.getElementById("pcos-detail-flag").style.display = "none";
  }

  const nextPeriod = new Date(today);
  nextPeriod.setDate(today.getDate() + data.predicted_length);
  document.getElementById("res-next-period").textContent =
    nextPeriod.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"long", year:"numeric" });

  const ovulationDate = new Date(today);
  ovulationDate.setDate(today.getDate() + data.est_ovulation - 1);
  document.getElementById("res-ovulation").textContent =
    "Day " + data.est_ovulation + " · " +
    ovulationDate.toLocaleDateString("en-GB", { day:"numeric", month:"short" });

  const fertileStart = new Date(today);
  fertileStart.setDate(today.getDate() + data.fertile_start - 1);
  const fertileEnd = new Date(today);
  fertileEnd.setDate(today.getDate() + data.fertile_end - 1);
  document.getElementById("res-fertile").textContent =
    "Days " + data.fertile_start + "–" + data.fertile_end + " · " +
    fertileStart.toLocaleDateString("en-GB", { day:"numeric", month:"short" }) + " – " +
    fertileEnd.toLocaleDateString("en-GB", { day:"numeric", month:"short" });

  document.getElementById("res-avg").textContent = Math.round(data.rolling_avg) + " days";
  document.getElementById("res-variability").textContent =
    data.variability.toFixed(1) + " days " + (data.variability <= 3 ? "· Very regular ✓" : data.variability <= 6 ? "· Moderate" : "· High variability");

  // Calendar phase map
  state.phaseMap = {};
  for (let d = 1; d <= data.predicted_length; d++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() + d - 1); dt.setHours(0,0,0,0);
    const key = dt.toDateString();
    if      (d <= mensesEnd)                                    state.phaseMap[key] = "period";
    else if (d === data.est_ovulation)                          state.phaseMap[key] = "ovulation";
    else if (d >= data.fertile_start && d <= data.fertile_end) state.phaseMap[key] = "fertile";
    else if (d > data.est_ovulation)                            state.phaseMap[key] = "luteal";
  }
  state.viewYear = today.getFullYear();
  state.viewMonth = today.getMonth();
  renderCalendar();
}

// ── History ───────────────────────────────────────────────────────────────────
async function loadHistory() {
  try {
    const res  = await fetch("/history");
    const data = await res.json();
    if (!data.success) return;
    renderHistory(data.history);
    renderTrendChart(data.history);
  } catch(_) {}
}

function renderHistory(records) {
  const list     = document.getElementById("history-list");
  const empty    = document.getElementById("history-empty");
  const clearBtn = document.getElementById("clear-history-btn");
  list.innerHTML = "";

  if (!records.length) {
    empty.style.display = "flex"; clearBtn.style.display = "none"; return;
  }
  empty.style.display = "none"; clearBtn.style.display = "inline-flex";

  records.forEach(r => {
    const date    = new Date(r.created_at + "Z");
    const dateStr = date.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
    const timeStr = date.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
    const pcosBadge = r.pcos_flag
      ? `<span class="hist-pcos-flag"><i class="fa-solid fa-triangle-exclamation"></i> PCOS Risk</span>`
      : `<span class="hist-pcos-ok"><i class="fa-solid fa-circle-check"></i> Normal</span>`;

    const card = document.createElement("div");
    card.className = "hist-card";
    card.innerHTML = `
      <div class="hist-top">
        <div class="hist-meta">
          <span class="hist-date">${dateStr}</span>
          <span class="hist-time">${timeStr}</span>
        </div>
        <button class="hist-delete-btn" title="Delete" data-id="${r.id}">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="hist-body">
        <div class="hist-stat">
          <span class="hist-val">${r.predicted_length}</span>
          <span class="hist-lbl">days</span>
        </div>
        <div class="hist-details">
          <div>Cycles: <strong>${r.cycle1} · ${r.cycle2} · ${r.cycle3}</strong></div>
          <div>Ovulation: <strong>Day ${r.est_ovulation}</strong></div>
          <div>Fertile: <strong>Days ${r.fertile_start}–${r.fertile_end}</strong></div>
          ${pcosBadge}
        </div>
      </div>`;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".hist-delete-btn")) return;
      restoreFromHistory(r);
    });
    card.querySelector(".hist-delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      await fetch(`/history/${r.id}`, { method: "DELETE" });
      await loadHistory();
    });
    list.appendChild(card);
  });
}

function restoreFromHistory(r) {
  const today = new Date(); today.setHours(0,0,0,0);
  state.phaseMap = {};
  const mensesEnd = Math.round(r.menses_length) || 5;
  for (let d = 1; d <= r.predicted_length; d++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() + d - 1); dt.setHours(0,0,0,0);
    const key = dt.toDateString();
    if      (d <= mensesEnd)                                        state.phaseMap[key] = "period";
    else if (d === r.est_ovulation)                                  state.phaseMap[key] = "ovulation";
    else if (d >= r.fertile_start && d <= r.fertile_end)            state.phaseMap[key] = "fertile";
    else if (d > r.est_ovulation)                                    state.phaseMap[key] = "luteal";
  }
  state.viewYear = today.getFullYear(); state.viewMonth = today.getMonth();
  renderCalendar();
  applyResults({
    predicted_length: r.predicted_length, pcos_flag: r.pcos_flag,
    pcos_probability: r.pcos_probability, est_ovulation: r.est_ovulation,
    fertile_start: r.fertile_start, fertile_end: r.fertile_end,
    rolling_avg: r.rolling_avg, variability: r.variability,
  }, { menses_length: r.menses_length });
}

async function clearHistory() {
  if (!confirm("Clear all saved predictions? This cannot be undone.")) return;
  await fetch("/history", { method: "DELETE" });
  await loadHistory();
  document.getElementById("results-panel").style.display = "none";
  document.getElementById("placeholder-card").style.display = "flex";
  state.phaseMap = {}; renderCalendar();
  document.getElementById("trend-section").style.display = "none";
}

// ── Trend chart ───────────────────────────────────────────────────────────────
function renderTrendChart(records) {
  const section = document.getElementById("trend-section");
  if (!records || records.length < 2) { section.style.display = "none"; return; }

  section.style.display = "block";

  // Oldest first for chart
  const ordered  = [...records].reverse();
  const labels   = ordered.map((r, i) => `#${i+1}`);
  const lengths  = ordered.map(r => r.predicted_length);
  const avgLen   = lengths.reduce((a,b) => a+b, 0) / lengths.length;
  const trend    = lengths[lengths.length-1] - lengths[0];

  // Insight text
  const name = state.settings.name ? state.settings.name : "Your";
  let insight = `${name === "Your" ? "Your" : name + "'s"} average predicted cycle is <strong>${avgLen.toFixed(1)} days</strong>. `;
  if (Math.abs(trend) < 1)       insight += "Cycles have been <strong>very stable</strong> — great consistency! ✨";
  else if (trend > 0)             insight += `Cycles are <strong>trending longer</strong> by ${trend.toFixed(1)} days — worth monitoring.`;
  else                            insight += `Cycles are <strong>trending shorter</strong> by ${Math.abs(trend).toFixed(1)} days — worth monitoring.`;
  document.getElementById("insight-card").innerHTML = insight;

  const ctx = document.getElementById("trend-chart").getContext("2d");
  if (state.trendChart) state.trendChart.destroy();

  state.trendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Predicted length (days)",
        data: lengths,
        borderColor: "#F72585",
        backgroundColor: "rgba(247,37,133,0.08)",
        borderWidth: 2.5,
        pointBackgroundColor: "#F72585",
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `${ctx.parsed.y} days` }
        }
      },
      scales: {
        y: {
          min: Math.max(18, Math.min(...lengths) - 3),
          max: Math.min(50, Math.max(...lengths) + 3),
          grid: { color: "rgba(247,37,133,0.08)" },
          ticks: { font: { size: 10 }, color: "#B09AB0" }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, color: "#B09AB0" }
        }
      }
    }
  });
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function renderCalendar() {
  const { viewYear, viewMonth, phaseMap } = state;
  document.getElementById("cal-month-title").textContent = MONTHS[viewMonth] + " " + viewYear;
  const grid        = document.getElementById("cal-grid");
  grid.innerHTML    = "";
  const today       = new Date(); today.setHours(0,0,0,0);
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevEnd     = new Date(viewYear, viewMonth, 0).getDate();

  for (let i = firstDow - 1; i >= 0; i--)
    grid.appendChild(makeDay(prevEnd - i, "other-month"));
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(viewYear, viewMonth, d); dt.setHours(0,0,0,0);
    grid.appendChild(makeDay(d, phaseMap[dt.toDateString()] || "", dt.getTime() === today.getTime()));
  }
  const rem = (firstDow + daysInMonth) % 7;
  if (rem > 0) for (let d = 1; d <= 7 - rem; d++) grid.appendChild(makeDay(d, "other-month"));
}

function makeDay(num, phase, isToday) {
  const el = document.createElement("div");
  el.className = "cal-day";
  el.textContent = num;
  if (phase)   el.classList.add(phase);
  if (isToday) el.classList.add("today");
  const tips = { period:"Period phase", fertile:"Fertile window", ovulation:"Ovulation day", luteal:"Luteal phase" };
  if (tips[phase]) el.title = tips[phase];
  return el;
}
