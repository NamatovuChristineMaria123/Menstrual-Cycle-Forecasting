const state = {
  viewYear:  new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  phaseMap:  {},
};
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

document.addEventListener("DOMContentLoaded", () => {
  renderCalendar();
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
});

document.getElementById("predict-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("predict-btn");
  btn.textContent = "Predicting...";
  btn.classList.add("loading");
  btn.disabled = true;

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
    applyResults(data, payload);
  } catch(err) {
    alert("Cannot reach server. Make sure app.py is running.");
  } finally {
    btn.textContent = "Predict My Cycle";
    btn.classList.remove("loading");
    btn.disabled = false;
  }
});

function applyResults(data, payload) {
  const mensesEnd = parseInt(payload.menses_length) || 5;
  const today = new Date(); today.setHours(0,0,0,0);

  // Hide placeholder, show results
  document.getElementById("placeholder-card").style.display = "none";
  const panel = document.getElementById("results-panel");
  panel.style.display = "flex";

  // Big number
  document.getElementById("res-length").textContent = data.predicted_length;

  // PCOS badge inside hero
  if (data.pcos_flag === 1) {
    document.getElementById("res-pcos-flag").style.display = "inline-flex";
    document.getElementById("res-pcos-ok").style.display   = "none";
    document.getElementById("pcos-detail-flag").style.display = "block";
    document.getElementById("pcos-detail-ok").style.display  = "none";
    document.getElementById("pcos-detail-text").textContent =
      "Risk probability: " + data.pcos_probability + "%. Your cycle length falls outside the normal 21–35 day range.";
  } else {
    document.getElementById("res-pcos-ok").style.display   = "inline-flex";
    document.getElementById("res-pcos-flag").style.display = "none";
    document.getElementById("pcos-detail-ok").style.display  = "block";
    document.getElementById("pcos-detail-flag").style.display = "none";
  }

  // Next period date
  const nextPeriod = new Date(today);
  nextPeriod.setDate(today.getDate() + data.predicted_length);
  document.getElementById("res-next-period").textContent =
    nextPeriod.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"long", year:"numeric" });

  // Ovulation
  const ovulationDate = new Date(today);
  ovulationDate.setDate(today.getDate() + data.est_ovulation - 1);
  document.getElementById("res-ovulation").textContent =
    "Day " + data.est_ovulation + " \u00B7 " +
    ovulationDate.toLocaleDateString("en-GB", { day:"numeric", month:"short" });

  // Fertile window
  const fertileStart = new Date(today);
  fertileStart.setDate(today.getDate() + data.fertile_start - 1);
  const fertileEnd = new Date(today);
  fertileEnd.setDate(today.getDate() + data.fertile_end - 1);
  document.getElementById("res-fertile").textContent =
    "Days " + data.fertile_start + "\u2013" + data.fertile_end + " \u00B7 " +
    fertileStart.toLocaleDateString("en-GB", { day:"numeric", month:"short" }) + " \u2013 " +
    fertileEnd.toLocaleDateString("en-GB", { day:"numeric", month:"short" });

  // Average
  document.getElementById("res-avg").textContent = Math.round(data.rolling_avg) + " days";

  // Phase map for calendar
  state.phaseMap = {};
  for (let d = 1; d <= data.predicted_length; d++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() + d - 1); dt.setHours(0,0,0,0);
    const key = dt.toDateString();
    if      (d <= mensesEnd)                                         state.phaseMap[key] = "period";
    else if (d === data.est_ovulation)                               state.phaseMap[key] = "ovulation";
    else if (d >= data.fertile_start && d <= data.fertile_end)      state.phaseMap[key] = "fertile";
    else if (d > data.est_ovulation)                                 state.phaseMap[key] = "luteal";
  }

  state.viewYear = today.getFullYear();
  state.viewMonth = today.getMonth();
  renderCalendar();
}

function renderCalendar() {
  const { viewYear, viewMonth, phaseMap } = state;
  document.getElementById("cal-month-title").textContent = MONTHS[viewMonth] + " " + viewYear;
  const grid = document.getElementById("cal-grid");
  grid.innerHTML = "";
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
