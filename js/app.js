(function () {
  "use strict";

  const STORAGE_KEY = "pulsegrid_state_v1";
  const STEPS = 16;

  const TRACKS = [
    { id: "kick", name: "KICK", color: "#f59e0b" },
    { id: "snare", name: "SNARE", color: "#fb7185" },
    { id: "hat", name: "HI-HAT", color: "#34d399" },
    { id: "bass", name: "BASS SYNTH", color: "#38bdf8" },
    { id: "chord", name: "CHORD STAB", color: "#a78bfa" }
  ];

  const PRESETS = {
    deepHouse: {
      bpm: 122,
      swing: 16,
      scale: "f-minor",
      grid: {
        kick:  [2,0,0,0, 1,0,0,0, 2,0,0,0, 1,0,0,1],
        snare: [0,0,0,0, 2,0,0,0, 0,0,0,0, 2,0,1,0],
        hat:   [0,0,2,0, 0,0,2,0, 0,0,2,0, 0,0,2,1],
        bass:  [2,0,0,1, 0,0,2,0, 1,0,0,1, 0,2,0,0],
        chord: [0,0,0,2, 0,0,0,0, 0,1,0,0, 0,0,2,0]
      }
    },
    lofiChill: {
      bpm: 88,
      swing: 28,
      scale: "c-dorian",
      grid: {
        kick:  [2,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,1,0],
        snare: [0,0,0,0, 2,0,0,1, 0,0,0,0, 2,0,0,0],
        hat:   [1,0,1,1, 1,0,2,0, 1,0,1,0, 1,0,2,1],
        bass:  [2,0,0,0, 0,0,1,0, 2,0,0,1, 0,0,1,0],
        chord: [2,0,0,0, 0,0,0,0, 1,0,0,2, 0,0,0,0]
      }
    },
    electroBreak: {
      bpm: 132,
      swing: 6,
      scale: "d-phrygian",
      grid: {
        kick:  [2,0,0,1, 0,0,2,0, 0,0,2,0, 0,1,0,0],
        snare: [0,0,0,0, 2,0,0,0, 0,0,0,1, 2,0,0,1],
        hat:   [1,1,2,1, 1,1,2,1, 1,1,2,1, 1,2,1,2],
        bass:  [2,0,1,0, 2,0,0,1, 2,0,1,0, 0,2,0,1],
        chord: [0,0,2,0, 0,0,0,2, 0,0,1,0, 0,0,2,0]
      }
    },
    clear: {
      bpm: 118,
      swing: 12,
      scale: "f-minor",
      grid: {
        kick:  new Array(STEPS).fill(0),
        snare: new Array(STEPS).fill(0),
        hat:   new Array(STEPS).fill(0),
        bass:  new Array(STEPS).fill(0),
        chord: new Array(STEPS).fill(0)
      }
    }
  };

  const matrixEl = document.getElementById("matrix");
  const playBtn = document.getElementById("playBtn");
  const stopBtn = document.getElementById("stopBtn");
  const randomBtn = document.getElementById("randomBtn");
  const exportBtn = document.getElementById("exportBtn");

  const bpmSlider = document.getElementById("bpmSlider");
  const bpmVal = document.getElementById("bpmVal");
  const swingSlider = document.getElementById("swingSlider");
  const swingVal = document.getElementById("swingVal");
  const volSlider = document.getElementById("volSlider");
  const volVal = document.getElementById("volVal");
  const scaleSelect = document.getElementById("scaleSelect");
  const cutoffSlider = document.getElementById("cutoffSlider");
  const cutoffVal = document.getElementById("cutoffVal");
  const driveSlider = document.getElementById("driveSlider");
  const driveVal = document.getElementById("driveVal");

  const stepTelemetry = document.getElementById("stepTelemetry");
  const scopeCanvas = document.getElementById("scopeCanvas");
  const scopeCtx = scopeCanvas.getContext("2d");
  const toastEl = document.getElementById("toast");

  const synth = new window.PulseSynth();
  const state = {
    bpm: 122,
    swing: 16,
    volume: 80,
    scale: "f-minor",
    cutoff: 1400,
    drive: 18,
    activePreset: "deepHouse",
    grid: cloneGrid(PRESETS.deepHouse.grid),
    muted: {},
    solo: {},
    isPlaying: false,
    currentStep: 0,
    nextNoteTime: 0,
    timerId: null
  };

  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 2200);
  }

  function cloneGrid(g) {
    const out = {};
    TRACKS.forEach((t) => {
      out[t.id] = g[t.id] ? g[t.id].slice(0, STEPS) : new Array(STEPS).fill(0);
    });
    return out;
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          bpm: state.bpm,
          swing: state.swing,
          volume: state.volume,
          scale: state.scale,
          cutoff: state.cutoff,
          drive: state.drive,
          activePreset: state.activePreset,
          grid: state.grid,
          muted: state.muted,
          solo: state.solo
        })
      );
    } catch (_e) {
      // Ignore storage quota errors
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.grid) {
        state.bpm = parsed.bpm || state.bpm;
        state.swing = Number.isFinite(parsed.swing) ? parsed.swing : state.swing;
        state.volume = Number.isFinite(parsed.volume) ? parsed.volume : state.volume;
        state.scale = parsed.scale || state.scale;
        state.cutoff = Number.isFinite(parsed.cutoff) ? parsed.cutoff : state.cutoff;
        state.drive = Number.isFinite(parsed.drive) ? parsed.drive : state.drive;
        state.activePreset = parsed.activePreset || "custom";
        state.grid = cloneGrid(parsed.grid);
        state.muted = parsed.muted || {};
        state.solo = parsed.solo || {};
      }
    } catch (_e) {
      // Ignore malformed storage
    }
  }

  function syncControlsToState() {
    bpmSlider.value = state.bpm;
    bpmVal.textContent = String(state.bpm);
    swingSlider.value = state.swing;
    swingVal.textContent = `${state.swing}%`;
    volSlider.value = state.volume;
    volVal.textContent = `${state.volume}%`;
    scaleSelect.value = state.scale;
    cutoffSlider.value = state.cutoff;
    cutoffVal.textContent = `${state.cutoff} Hz`;
    driveSlider.value = state.drive;
    driveVal.textContent = `${state.drive}%`;

    synth.setVolume(state.volume);
    synth.setScale(state.scale);
    synth.setCutoff(state.cutoff);
    synth.setDrive(state.drive);

    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.preset === state.activePreset);
    });
  }

  function renderMatrix() {
    matrixEl.innerHTML = "";

    // Step numbers ruler
    const ruler = document.createElement("div");
    ruler.className = "step-ruler";
    const spacer = document.createElement("div");
    spacer.className = "ruler-spacer";
    spacer.textContent = "VOICE / STEP";
    ruler.appendChild(spacer);

    for (let s = 0; s < STEPS; s++) {
      const num = document.createElement("div");
      num.className = "step-num" + (s % 4 === 0 ? " is-beat" : "");
      num.dataset.stepIndex = String(s);
      num.textContent = String(s + 1).padStart(2, "0");
      ruler.appendChild(num);
    }
    matrixEl.appendChild(ruler);

    // Track rows
    TRACKS.forEach((track) => {
      const row = document.createElement("div");
      row.className = "track-row";

      const meta = document.createElement("div");
      meta.className = "track-meta";

      const badge = document.createElement("div");
      badge.className = "track-badge";
      const dot = document.createElement("span");
      dot.className = "track-dot";
      dot.style.background = track.color;
      const label = document.createElement("span");
      label.className = "track-name";
      label.textContent = track.name;
      badge.appendChild(dot);
      badge.appendChild(label);

      const ctrls = document.createElement("div");
      ctrls.className = "track-controls";

      const muteBtn = document.createElement("button");
      muteBtn.type = "button";
      muteBtn.className = "mini-toggle" + (state.muted[track.id] ? " is-muted" : "");
      muteBtn.textContent = "M";
      muteBtn.title = `Mute ${track.name}`;
      muteBtn.setAttribute("aria-pressed", String(Boolean(state.muted[track.id])));
      muteBtn.addEventListener("click", () => {
        state.muted[track.id] = !state.muted[track.id];
        muteBtn.classList.toggle("is-muted", state.muted[track.id]);
        muteBtn.setAttribute("aria-pressed", String(state.muted[track.id]));
        saveState();
      });

      const soloBtn = document.createElement("button");
      soloBtn.type = "button";
      soloBtn.className = "mini-toggle" + (state.solo[track.id] ? " is-solo" : "");
      soloBtn.textContent = "S";
      soloBtn.title = `Solo ${track.name}`;
      soloBtn.setAttribute("aria-pressed", String(Boolean(state.solo[track.id])));
      soloBtn.addEventListener("click", () => {
        state.solo[track.id] = !state.solo[track.id];
        soloBtn.classList.toggle("is-solo", state.solo[track.id]);
        soloBtn.setAttribute("aria-pressed", String(state.solo[track.id]));
        saveState();
      });

      ctrls.appendChild(muteBtn);
      ctrls.appendChild(soloBtn);
      meta.appendChild(badge);
      meta.appendChild(ctrls);
      row.appendChild(meta);

      for (let s = 0; s < STEPS; s++) {
        const val = state.grid[track.id][s];
        const pad = document.createElement("button");
        pad.type = "button";
        pad.className = "step-pad";
        if (val > 0) pad.classList.add("is-on");
        if (val >= 2) pad.classList.add("is-accent");
        pad.style.color = track.color;
        pad.dataset.track = track.id;
        pad.dataset.step = String(s);
        pad.dataset.beat = Math.floor(s / 4) % 2 === 1 ? "odd" : "even";
        pad.setAttribute("aria-label", `${track.name} step ${s + 1}`);
        pad.setAttribute("aria-pressed", String(val > 0));

        const toggleStep = (accentRequested) => {
          const prev = state.grid[track.id][s];
          let next = 0;
          if (accentRequested) {
            next = prev === 2 ? 0 : 2;
          } else {
            next = prev > 0 ? 0 : 1;
          }
          state.grid[track.id][s] = next;
          state.activePreset = "custom";
          pad.classList.toggle("is-on", next > 0);
          pad.classList.toggle("is-accent", next >= 2);
          pad.setAttribute("aria-pressed", String(next > 0));
          document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("is-active"));
          saveState();
        };

        pad.addEventListener("click", (e) => toggleStep(e.shiftKey));
        pad.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          toggleStep(true);
        });

        row.appendChild(pad);
      }

      matrixEl.appendChild(row);
    });
  }

  function highlightPlayhead(step) {
    document.querySelectorAll(".step-num.is-now").forEach((el) => el.classList.remove("is-now"));
    document.querySelectorAll(".step-pad.is-current").forEach((el) => el.classList.remove("is-current"));

    if (!state.isPlaying) {
      stepTelemetry.textContent = `STEP ${String(state.currentStep + 1).padStart(2, "0")} / 16 · IDLE`;
      return;
    }

    const rEl = matrixEl.querySelector(`.step-num[data-step-index="${step}"]`);
    if (rEl) rEl.classList.add("is-now");

    matrixEl.querySelectorAll(`.step-pad[data-step="${step}"]`).forEach((p) => {
      p.classList.add("is-current");
    });

    stepTelemetry.textContent = `STEP ${String(step + 1).padStart(2, "0")} / 16 · ${state.bpm} BPM`;
  }

  function isTrackAudible(trackId) {
    const anySolo = TRACKS.some((t) => Boolean(state.solo[t.id]));
    if (anySolo) return Boolean(state.solo[trackId]);
    return !state.muted[trackId];
  }

  function scheduleStep(step, time) {
    TRACKS.forEach((t) => {
      const vel = state.grid[t.id][step];
      if (vel > 0 && isTrackAudible(t.id)) {
        synth.triggerTrack(t.id, time, step, vel);
      }
    });

    const delayMs = Math.max(0, (time - synth.ctx.currentTime) * 1000);
    setTimeout(() => {
      if (state.isPlaying) highlightPlayhead(step);
    }, delayMs);
  }

  function advanceNote() {
    const secondsPerBeat = 60.0 / state.bpm;
    const base16th = 0.25 * secondsPerBeat;
    const swingAmount = (state.swing / 100) * 0.45 * base16th;
    const stepDuration = state.currentStep % 2 === 0 ? base16th + swingAmount : base16th - swingAmount;

    state.nextNoteTime += stepDuration;
    state.currentStep = (state.currentStep + 1) % STEPS;
  }

  function schedulerTick() {
    if (!state.isPlaying || !synth.ctx) return;
    while (state.nextNoteTime < synth.ctx.currentTime + 0.1) {
      scheduleStep(state.currentStep, state.nextNoteTime);
      advanceNote();
    }
  }

  async function togglePlay() {
    if (state.isPlaying) {
      state.isPlaying = false;
      clearInterval(state.timerId);
      state.timerId = null;
      playBtn.classList.remove("is-playing");
      playBtn.textContent = "Play (Space)";
      playBtn.setAttribute("aria-pressed", "false");
      highlightPlayhead(state.currentStep);
      return;
    }

    await synth.init();
    state.isPlaying = true;
    state.nextNoteTime = synth.ctx.currentTime + 0.04;
    state.timerId = setInterval(schedulerTick, 25);
    playBtn.classList.add("is-playing");
    playBtn.textContent = "Pause (Space)";
    playBtn.setAttribute("aria-pressed", "true");
    highlightPlayhead(state.currentStep);
  }

  function stopTransport() {
    if (state.isPlaying) {
      clearInterval(state.timerId);
      state.timerId = null;
      state.isPlaying = false;
    }
    state.currentStep = 0;
    playBtn.classList.remove("is-playing");
    playBtn.textContent = "Play (Space)";
    playBtn.setAttribute("aria-pressed", "false");
    highlightPlayhead(0);
  }

  function randomizeGroove() {
    const g = {
      kick: new Array(STEPS).fill(0),
      snare: new Array(STEPS).fill(0),
      hat: new Array(STEPS).fill(0),
      bass: new Array(STEPS).fill(0),
      chord: new Array(STEPS).fill(0)
    };
    for (let s = 0; s < STEPS; s++) {
      if (s % 4 === 0 || (Math.random() < 0.18 && s % 2 === 0)) g.kick[s] = s % 8 === 0 ? 2 : 1;
      if (s === 4 || s === 12 || (Math.random() < 0.15 && s % 2 === 1)) g.snare[s] = s % 4 === 0 ? 2 : 1;
      if (s % 2 === 1 || Math.random() < 0.4) g.hat[s] = Math.random() < 0.25 ? 2 : 1;
      if (s % 2 === 0 && Math.random() < 0.52) g.bass[s] = Math.random() < 0.35 ? 2 : 1;
      if ((s % 4 === 2 || s === 0) && Math.random() < 0.36) g.chord[s] = Math.random() < 0.4 ? 2 : 1;
    }
    state.grid = g;
    state.activePreset = "custom";
    syncControlsToState();
    renderMatrix();
    saveState();
    showToast("Generated randomized groove");
  }

  function drawScope() {
    const w = scopeCanvas.width;
    const h = scopeCanvas.height;
    scopeCtx.fillStyle = "#090b0f";
    scopeCtx.fillRect(0, 0, w, h);

    // Grid lines
    scopeCtx.strokeStyle = "rgba(255,255,255,0.06)";
    scopeCtx.lineWidth = 1;
    scopeCtx.beginPath();
    scopeCtx.moveTo(0, h / 2);
    scopeCtx.lineTo(w, h / 2);
    scopeCtx.stroke();

    const buf = new Uint8Array(512);
    const hasAudio = state.isPlaying && synth.readWaveform(buf);

    scopeCtx.lineWidth = 2;
    scopeCtx.strokeStyle = state.isPlaying ? "#f59e0b" : "#4b5563";
    scopeCtx.beginPath();

    const slice = w / buf.length;
    for (let i = 0; i < buf.length; i++) {
      const sample = hasAudio ? (buf[i] - 128) / 128 : 0;
      const y = h / 2 + sample * (h * 0.42);
      const x = i * slice;
      if (i === 0) scopeCtx.moveTo(x, y);
      else scopeCtx.lineTo(x, y);
    }
    scopeCtx.stroke();

    requestAnimationFrame(drawScope);
  }

  // Controls binding
  playBtn.addEventListener("click", togglePlay);
  stopBtn.addEventListener("click", stopTransport);
  randomBtn.addEventListener("click", randomizeGroove);

  exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({
      name: "PulseGrid Pattern",
      bpm: state.bpm,
      swing: state.swing,
      scale: state.scale,
      grid: state.grid
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulsegrid-${state.bpm}bpm.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Pattern exported as JSON");
  });

  bpmSlider.addEventListener("input", () => {
    state.bpm = Number(bpmSlider.value);
    bpmVal.textContent = String(state.bpm);
    saveState();
  });

  swingSlider.addEventListener("input", () => {
    state.swing = Number(swingSlider.value);
    swingVal.textContent = `${state.swing}%`;
    saveState();
  });

  volSlider.addEventListener("input", () => {
    state.volume = Number(volSlider.value);
    volVal.textContent = `${state.volume}%`;
    synth.setVolume(state.volume);
    saveState();
  });

  scaleSelect.addEventListener("change", () => {
    state.scale = scaleSelect.value;
    synth.setScale(state.scale);
    saveState();
  });

  cutoffSlider.addEventListener("input", () => {
    state.cutoff = Number(cutoffSlider.value);
    cutoffVal.textContent = `${state.cutoff} Hz`;
    synth.setCutoff(state.cutoff);
    saveState();
  });

  driveSlider.addEventListener("input", () => {
    state.drive = Number(driveSlider.value);
    driveVal.textContent = `${state.drive}%`;
    synth.setDrive(state.drive);
    saveState();
  });

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.preset;
      const preset = PRESETS[key];
      if (!preset) return;
      state.activePreset = key;
      state.bpm = preset.bpm;
      state.swing = preset.swing;
      state.scale = preset.scale;
      state.grid = cloneGrid(preset.grid);
      syncControlsToState();
      renderMatrix();
      saveState();
      showToast(`Loaded preset: ${btn.textContent}`);
    });
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "SELECT") {
      e.preventDefault();
      togglePlay();
    }
  });

  loadState();
  syncControlsToState();
  renderMatrix();
  highlightPlayhead(0);
  drawScope();
})();
