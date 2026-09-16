import type { DuelCue } from './battle-director';

/** Original procedural sound design. No media files, network requests, or autoplay. */
export class BattleAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  async unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.35;
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -16;
        compressor.ratio.value = 5;
        this.master.connect(compressor);
        compressor.connect(this.context.destination);
        this.noise = this.context.createBuffer(
          1,
          this.context.sampleRate,
          this.context.sampleRate,
        );
        const channel = this.noise.getChannelData(0);
        let seed = 137;
        for (let i = 0; i < channel.length; i++) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          channel[i] = (seed / 0xffffffff) * 2 - 1;
        }
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      /* A browser may decline audio; gameplay remains available. */
    }
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        muted ? 0 : 0.35,
        this.context.currentTime,
        0.035,
      );
  }
  private tone(
    frequency: number,
    end: number,
    delay: number,
    length: number,
    volume: number,
    type: OscillatorType = 'sine',
  ) {
    const ctx = this.context!;
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), at + length);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(at);
    osc.stop(at + length + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  private rush(frequency: number, end: number, length: number, volume: number) {
    const ctx = this.context!;
    const at = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(frequency, at);
    filter.frequency.exponentialRampToValueAtTime(end, at + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    source.start(at);
    source.stop(at + length);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  play(cue: DuelCue) {
    if (!this.context || this.context.state !== 'running' || this.muted) return;
    if (cue.kind === 'phase') {
      this.tone(440, 440, 0, 0.24, 0.14, 'triangle');
      this.tone(660, 660, 0.09, 0.5, 0.12);
      return;
    }
    if (cue.kind === 'direction') {
      this.rush(450, 2800, 0.4, 0.24);
      return;
    }
    if (cue.kind === 'reveal') {
      this.rush(2500, 800, 0.16, 0.26);
      this.tone(1046, 784, 0.02, 0.18, 0.08);
      return;
    }
    if (cue.kind === 'utility') {
      this.tone(330, 660, 0, 0.25, 0.15);
      return;
    }
    if (cue.kind !== 'impact') return;
    const kind = cue.profile.kind;
    if (kind === 'heal' || kind === 'status' || kind === 'guts') {
      [523, 659, 784, 1046].forEach((note, index) =>
        this.tone(note, note, index * 0.07, 0.65, 0.12),
      );
      return;
    }
    if (kind === 'shield' || kind === 'reflect' || kind === 'redirect') {
      this.rush(1600, 4000, 0.3, 0.25);
      [880, 1320, 1760].forEach((note) => this.tone(note, note, 0, 0.6, 0.12));
      return;
    }
    this.rush(kind === 'energy' ? 700 : 3200, 120, 0.34, 0.55);
    this.tone(
      150 + cue.profile.intensity * 30,
      38,
      0.02,
      0.38,
      0.5,
      'triangle',
    );
    if (kind === 'slash' || kind === 'fang') this.rush(5400, 500, 0.23, 0.4);
    if (cue.afterLife === 0) {
      this.tone(90, 25, 0.12, 0.9, 0.42);
      this.rush(500, 100, 0.75, 0.3);
    }
  }
  dispose() {
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.master = null;
    this.noise = null;
  }
}
