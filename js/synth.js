(function (global) {
  "use strict";

  const SCALES = {
    "f-minor": [87.31, 98.0, 103.83, 116.54, 130.81, 138.59, 155.56, 174.61],
    "a-minor": [110.0, 123.47, 130.81, 146.83, 164.81, 174.61, 196.0, 220.0],
    "c-dorian": [130.81, 146.83, 155.56, 174.61, 196.0, 220.0, 233.08, 261.63],
    "d-phrygian": [73.42, 77.78, 87.31, 98.0, 110.0, 116.54, 130.81, 146.83]
  };

  const BASS_DEGREES = [0, 0, 2, 0, 4, 3, 2, 5, 0, 0, 6, 4, 2, 3, 1, 4];
  const CHORD_DEGREES = [0, 4, 2, 5, 0, 3, 4, 1, 0, 4, 2, 6, 3, 4, 1, 2];

  class PulseSynth {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.analyser = null;
      this.shaper = null;
      this.noiseBuffer = null;
      this.cutoff = 1400;
      this.drive = 18;
      this.scaleKey = "f-minor";
      this.volume = 0.8;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        this.ctx = new AudioCtx();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;

        this.shaper = this.ctx.createWaveShaper();
        this.setDrive(this.drive);

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 1024;

        this.shaper.connect(this.masterGain);
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        this.noiseBuffer = this.buildNoiseBuffer();
      }
      if (this.ctx.state === "suspended") {
        return this.ctx.resume();
      }
      return Promise.resolve();
    }

    buildNoiseBuffer() {
      const length = this.ctx.sampleRate * 1.2;
      const buf = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < length; i++) {
        ch[i] = Math.random() * 2 - 1;
      }
      return buf;
    }

    setVolume(pct) {
      this.volume = Math.max(0.05, Math.min(1, pct / 100));
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
      }
    }

    setCutoff(hz) {
      this.cutoff = hz;
    }

    setScale(key) {
      if (SCALES[key]) this.scaleKey = key;
    }

    setDrive(amount) {
      this.drive = amount;
      if (!this.shaper) return;
      const k = amount * 1.2;
      const nSamples = 44100;
      const curve = new Float32Array(nSamples);
      const deg = Math.PI / 180;
      for (let i = 0; i < nSamples; i++) {
        const x = (i * 2) / nSamples - 1;
        curve[i] = k === 0 ? x : ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
      this.shaper.curve = curve;
    }

    getDestination() {
      return this.shaper || this.masterGain;
    }

    triggerKick(time, accent) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(accent ? 165 : 140, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);

      gain.gain.setValueAtTime(accent ? 0.95 : 0.72, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);

      osc.connect(gain);
      gain.connect(this.getDestination());
      osc.start(time);
      osc.stop(time + 0.34);
    }

    triggerSnare(time, accent) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(accent ? 2200 : 1850, time);
      filter.Q.value = 0.85;

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(accent ? 0.65 : 0.45, time);
      nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.19);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.getDestination());
      noise.start(time);
      noise.stop(time + 0.2);

      const tone = this.ctx.createOscillator();
      const tGain = this.ctx.createGain();
      tone.type = "triangle";
      tone.frequency.setValueAtTime(195, time);
      tone.frequency.exponentialRampToValueAtTime(110, time + 0.08);
      tGain.gain.setValueAtTime(accent ? 0.42 : 0.28, time);
      tGain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

      tone.connect(tGain);
      tGain.connect(this.getDestination());
      tone.start(time);
      tone.stop(time + 0.12);
    }

    triggerHat(time, accent) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(7200, time);

      const gain = this.ctx.createGain();
      const dur = accent ? 0.18 : 0.065;
      gain.gain.setValueAtTime(accent ? 0.38 : 0.24, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.getDestination());
      noise.start(time);
      noise.stop(time + dur + 0.01);
    }

    triggerBass(time, step, accent) {
      const scale = SCALES[this.scaleKey] || SCALES["f-minor"];
      const freq = scale[BASS_DEGREES[step % BASS_DEGREES.length]] * 0.5;

      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, time);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = accent ? 5.5 : 3.2;
      filter.frequency.setValueAtTime(Math.min(4800, this.cutoff * (accent ? 1.5 : 1)), time);
      filter.frequency.exponentialRampToValueAtTime(120, time + 0.22);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(accent ? 0.44 : 0.3, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.26);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.getDestination());
      osc.start(time);
      osc.stop(time + 0.28);
    }

    triggerChord(time, step, accent) {
      const scale = SCALES[this.scaleKey] || SCALES["f-minor"];
      const deg = CHORD_DEGREES[step % CHORD_DEGREES.length];
      const root = scale[deg];
      const third = scale[(deg + 2) % scale.length] * (deg + 2 >= scale.length ? 2 : 1);
      const fifth = scale[(deg + 4) % scale.length] * (deg + 4 >= scale.length ? 2 : 1);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(this.cutoff, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(accent ? 0.22 : 0.14, time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

      filter.connect(gain);
      gain.connect(this.getDestination());

      [root * 2, third * 2, fifth * 2].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = i === 0 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, time);
        osc.detune.value = (i - 1) * 7;
        osc.connect(filter);
        osc.start(time);
        osc.stop(time + 0.37);
      });
    }

    triggerTrack(trackId, time, step, velocity) {
      if (!this.ctx) return;
      const accent = velocity >= 2;
      if (trackId === "kick") this.triggerKick(time, accent);
      else if (trackId === "snare") this.triggerSnare(time, accent);
      else if (trackId === "hat") this.triggerHat(time, accent);
      else if (trackId === "bass") this.triggerBass(time, step, accent);
      else if (trackId === "chord") this.triggerChord(time, step, accent);
    }

    readWaveform(outArray) {
      if (!this.analyser) return false;
      this.analyser.getByteTimeDomainData(outArray);
      return true;
    }
  }

  global.PulseSynth = PulseSynth;
})(window);
