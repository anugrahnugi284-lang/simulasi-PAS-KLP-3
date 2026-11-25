import type { SimulationState, TelemetrySnapshot } from '../types/simulation';

/**
 * Procedural Web Audio synthesizer for Public Address System acoustic feedback.
 * Generates PA paging chime, subtle BGM ambient chord, paging carrier tone,
 * and emergency evacuation sweep alarm without external audio assets.
 */
export class PAAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private eqFilter: BiquadFilterNode | null = null;
  private bgmOsc1: OscillatorNode | null = null;
  private bgmOsc2: OscillatorNode | null = null;
  private bgmGain: GainNode | null = null;
  private pttOsc: OscillatorNode | null = null;
  private pttGain: GainNode | null = null;
  private alarmOsc: OscillatorNode | null = null;
  private alarmGain: GainNode | null = null;
  private alarmInterval: number | null = null;
  private wasPtt = false;
  private isInitialized = false;

  public init(): void {
    if (this.isInitialized) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const eqFilter = ctx.createBiquadFilter();
    eqFilter.type = 'peaking';
    eqFilter.frequency.value = 1200;
    eqFilter.Q.value = 1.0;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;

    eqFilter.connect(masterGain);
    masterGain.connect(ctx.destination);

    // BGM ambient two-oscillator soft pad
    const bgmGain = ctx.createGain();
    bgmGain.gain.value = 0;
    const bgmOsc1 = ctx.createOscillator();
    bgmOsc1.type = 'sine';
    bgmOsc1.frequency.value = 220;
    const bgmOsc2 = ctx.createOscillator();
    bgmOsc2.type = 'triangle';
    bgmOsc2.frequency.value = 329.63; // E4 fifth
    bgmOsc1.connect(bgmGain);
    bgmOsc2.connect(bgmGain);
    bgmGain.connect(eqFilter);
    bgmOsc1.start();
    bgmOsc2.start();

    // PTT gentle vocal formant hum
    const pttGain = ctx.createGain();
    pttGain.gain.value = 0;
    const pttOsc = ctx.createOscillator();
    pttOsc.type = 'sawtooth';
    pttOsc.frequency.value = 145;
    const pttFilter = ctx.createBiquadFilter();
    pttFilter.type = 'lowpass';
    pttFilter.frequency.value = 520;
    pttOsc.connect(pttFilter);
    pttFilter.connect(pttGain);
    pttGain.connect(eqFilter);
    pttOsc.start();

    // Evacuation Alarm oscillator
    const alarmGain = ctx.createGain();
    alarmGain.gain.value = 0;
    const alarmOsc = ctx.createOscillator();
    alarmOsc.type = 'square';
    alarmOsc.frequency.value = 660;
    const alarmFilter = ctx.createBiquadFilter();
    alarmFilter.type = 'lowpass';
    alarmFilter.frequency.value = 1400;
    alarmOsc.connect(alarmFilter);
    alarmFilter.connect(alarmGain);
    alarmGain.connect(eqFilter);
    alarmOsc.start();

    this.eqFilter = eqFilter;
    this.masterGain = masterGain;
    this.bgmGain = bgmGain;
    this.bgmOsc1 = bgmOsc1;
    this.bgmOsc2 = bgmOsc2;
    this.pttGain = pttGain;
    this.pttOsc = pttOsc;
    this.alarmGain = alarmGain;
    this.alarmOsc = alarmOsc;
    this.isInitialized = true;
  }

  private playChime(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [587.33, 739.99, 880]; // D5 -> F#5 -> A5 PA chime
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = now + idx * 0.14;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    });
  }

  public update(state: SimulationState, telemetry: TelemetrySnapshot): void {
    if (state.audioEnabled && !this.isInitialized) {
      this.init();
    }
    if (!this.ctx || !this.masterGain || !this.eqFilter || !this.bgmGain || !this.pttGain || !this.alarmGain) {
      this.wasPtt = state.ptt;
      return;
    }

    if (state.audioEnabled && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    if (state.audioEnabled && state.ptt && !this.wasPtt && !telemetry.protectTripped) {
      this.playChime();
    }
    this.wasPtt = state.ptt;

    const cableAtten = Math.max(0.45, 1 - (state.cableMeters / 400) * 0.35);
    const tapScale = state.tapWatts / 15;
    const outputLevel =
      state.audioEnabled && !telemetry.protectTripped
        ? Math.min(0.28, state.gain * state.fader * state.atten * cableAtten * (0.4 + tapScale * 0.6) * 0.35)
        : 0;

    this.masterGain.gain.setTargetAtTime(outputLevel, now, 0.06);
    this.eqFilter.gain.setTargetAtTime(state.eq, now, 0.06);

    const priorityActive = state.ptt || state.alarm;
    this.bgmGain.gain.setTargetAtTime(state.bgm && !priorityActive ? 0.14 : 0, now, 0.08);
    this.pttGain.gain.setTargetAtTime(state.ptt && !state.alarm ? 0.18 : 0, now, 0.05);
    this.alarmGain.gain.setTargetAtTime(state.alarm ? 0.16 : 0, now, 0.04);

    if (state.audioEnabled && state.alarm && !telemetry.protectTripped) {
      if (this.alarmInterval === null) {
        let high = false;
        this.alarmInterval = window.setInterval(() => {
          if (!this.ctx || !this.alarmOsc) return;
          high = !high;
          this.alarmOsc.frequency.setTargetAtTime(high ? 880 : 620, this.ctx.currentTime, 0.04);
        }, 380);
      }
    } else if (this.alarmInterval !== null) {
      window.clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  public dispose(): void {
    if (this.alarmInterval !== null) {
      window.clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    try {
      this.bgmOsc1?.stop();
      this.bgmOsc2?.stop();
      this.pttOsc?.stop();
      this.alarmOsc?.stop();
      void this.ctx?.close();
    } catch {
      // ignore disposal errors
    }
    this.isInitialized = false;
  }
}
