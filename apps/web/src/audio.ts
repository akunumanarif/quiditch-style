// Original synthesized wind and UI tones. No external sound recordings.
export class FlightAudio {
  private ctx?: AudioContext;
  private wind?: GainNode;
  private filter?: BiquadFilterNode;
  private enabled = true;
  private airPan?: StereoPannerNode;
  private hiss?: GainNode;
  private noise?: AudioBuffer;
  unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      let seed = 12345;
      for (let n = 0; n < channel.length; n++) {
        seed = (seed * 16807) % 2147483647;
        channel[n] = (seed / 2147483647 - 0.5) * 0.5;
      }
      this.noise = buffer;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      this.filter = ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 400;
      this.wind = ctx.createGain();
      this.wind.gain.value = 0;
      this.airPan = ctx.createStereoPanner();
      source
        .connect(this.filter)
        .connect(this.wind)
        .connect(this.airPan)
        .connect(ctx.destination);
      const high = ctx.createBiquadFilter();
      high.type = "highpass";
      high.frequency.value = 950;
      this.hiss = ctx.createGain();
      this.hiss.gain.value = 0;
      source.connect(high).connect(this.hiss).connect(this.airPan);
      source.start();
    }
    void this.ctx.resume();
  }
  setEnabled(value: boolean) {
    this.enabled = value;
    if (!value && this.ctx && this.hiss)
      this.hiss.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    if (!value && this.wind && this.ctx)
      this.wind.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }
  update(
    speed: number,
    active: boolean,
    pressure = 0,
    crosswind = 0,
    load = 1,
  ) {
    if (!this.ctx || !this.wind || !this.filter) return;
    this.wind.gain.setTargetAtTime(
      this.enabled && active
        ? Math.min(
            0.34,
            0.04 + pressure * 0.00022 + Math.max(0, load - 1) * 0.012,
          )
        : 0,
      this.ctx.currentTime,
      0.15,
    );
    this.hiss?.gain.setTargetAtTime(
      this.enabled && active ? Math.min(0.12, pressure * 0.0001) : 0,
      this.ctx.currentTime,
      0.12,
    );
    this.airPan?.pan.setTargetAtTime(
      Math.max(-0.6, Math.min(0.6, crosswind / 7)),
      this.ctx.currentTime,
      0.2,
    );
    this.filter.frequency.setTargetAtTime(
      280 + speed * 38 + Math.max(0, load - 1) * 100,
      this.ctx.currentTime,
      0.15,
    );
  }
  quickTurn() {
    if (!this.ctx || !this.noise || !this.enabled) return;
    const ctx = this.ctx,
      source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      t = ctx.currentTime;
    source.buffer = this.noise;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(280, t);
    filter.frequency.exponentialRampToValueAtTime(1800, t + 0.3);
    filter.frequency.exponentialRampToValueAtTime(450, t + 0.75);
    filter.Q.value = 0.5;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.26, t + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    source.stop(t + 0.9);
  }
  cue(success = true) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator(),
        gain = ctx.createGain(),
        time = ctx.currentTime + i * 0.1;
      osc.type = "sine";
      osc.frequency.value = (success ? 660 : 220) * (i ? 1.5 : 1);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.075, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.22);
    }
  }
}
