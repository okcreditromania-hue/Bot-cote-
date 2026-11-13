// Authentic Real Aircraft Propeller Engine, Takeoff, Cashout & Crash Sound Engine

class AviatorSoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Continuous multi-layer in-flight aircraft engine nodes
  private engineMainOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private propLfoOsc: OscillatorNode | null = null;
  private propLfoGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineMasterGain: GainNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  public enabled = true;
  private gestureHookAttached = false;

  constructor() {
    if (typeof window !== 'undefined' && !this.gestureHookAttached) {
      this.gestureHookAttached = true;
      const unlockHandler = () => {
        if (this.enabled) this.unlock();
      };
      window.addEventListener('pointerdown', unlockHandler, { passive: true });
      window.addEventListener('keydown', unlockHandler, { passive: true });
    }
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.noiseBuffer) {
      this.noiseBuffer = this.createPinkNoiseBuffer(this.ctx);
    }
    return this.ctx;
  }

  private createPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  public unlock() {
    this.getContext();
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (!val) {
      this.stopFlightHum();
    } else {
      this.unlock();
    }
  }

  // Soft 10s Bot Code 15 alert chime
  public playSignalAlert() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [587.33, 880, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.05, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.17);
    });
  }

  // Subtle countdown tick during pre-flight 10s
  public playCountdownTick(secondsLeft: number) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(secondsLeft <= 3 ? 740 : 523.25, now);

    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Realistic aircraft engine start + throttle-up for takeoff
  public playTakeoff() {
    const ctx = this.getContext();
    if (!ctx) return;

    // Launch real continuous propeller engine & rushing air wash
    this.startFlightHum(true);
  }

  public startFlightHum(withTakeoffSweep = false) {
    const ctx = this.getContext();
    if (!ctx || this.engineMainOsc) return;

    try {
      const now = ctx.currentTime;

      // 1. Primary Piston / Turboprop Rumble
      const mainOsc = ctx.createOscillator();
      mainOsc.type = 'sawtooth';
      mainOsc.frequency.setValueAtTime(withTakeoffSweep ? 44 : 58, now);
      if (withTakeoffSweep) {
        mainOsc.frequency.exponentialRampToValueAtTime(62, now + 0.85);
      }

      // 2. Sub-harmonic fuselage vibration
      const subOsc = ctx.createOscillator();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(withTakeoffSweep ? 22 : 29, now);
      if (withTakeoffSweep) {
        subOsc.frequency.exponentialRampToValueAtTime(31, now + 0.85);
      }

      // 3. Warm acoustic lowpass shaping
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.Q.value = 1.6;
      engineFilter.frequency.setValueAtTime(withTakeoffSweep ? 140 : 210, now);
      if (withTakeoffSweep) {
        engineFilter.frequency.exponentialRampToValueAtTime(220, now + 0.85);
      }

      // 4. Propeller blade chop LFO (amplitude modulation at ~11Hz)
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.linearRampToValueAtTime(0.068, now + 0.35);

      const propLfo = ctx.createOscillator();
      propLfo.type = 'sine';
      propLfo.frequency.setValueAtTime(withTakeoffSweep ? 8.5 : 11.5, now);
      if (withTakeoffSweep) {
        propLfo.frequency.linearRampToValueAtTime(12.0, now + 0.85);
      }
      const propLfoGain = ctx.createGain();
      propLfoGain.gain.value = 0.022;
      propLfo.connect(propLfoGain);
      propLfoGain.connect(masterGain.gain);

      mainOsc.connect(engineFilter);
      subOsc.connect(engineFilter);
      engineFilter.connect(masterGain);
      masterGain.connect(ctx.destination);

      mainOsc.start(now);
      subOsc.start(now);
      propLfo.start(now);

      this.engineMainOsc = mainOsc;
      this.engineSubOsc = subOsc;
      this.propLfoOsc = propLfo;
      this.propLfoGain = propLfoGain;
      this.engineFilter = engineFilter;
      this.engineMasterGain = masterGain;

      // 5. Realistic Propeller Air-Wash / Flight Wind Loop
      if (this.noiseBuffer) {
        const windSrc = ctx.createBufferSource();
        windSrc.buffer = this.noiseBuffer;
        windSrc.loop = true;

        const windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.Q.value = 0.9;
        windFilter.frequency.setValueAtTime(withTakeoffSweep ? 220 : 320, now);
        if (withTakeoffSweep) {
          windFilter.frequency.exponentialRampToValueAtTime(340, now + 0.85);
        }

        const windGain = ctx.createGain();
        windGain.gain.setValueAtTime(0.001, now);
        windGain.gain.linearRampToValueAtTime(0.055, now + 0.4);

        windSrc.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(ctx.destination);
        windSrc.start(now);

        this.windSource = windSrc;
        this.windFilter = windFilter;
        this.windGain = windGain;
      }
    } catch {
      // ignore audio context init restrictions
    }
  }

  public updateFlightPitch(multiplier: number) {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // Auto-start engine hum if user tapped during mid-flight
    if (!this.engineMainOsc) {
      this.startFlightHum(false);
    }

    try {
      const now = ctx.currentTime;
      const climbRatio = Math.min(1, Math.log10(Math.max(1, multiplier)) / 1.5);
      const baseHz = 60 + climbRatio * 34;

      if (this.engineMainOsc) {
        this.engineMainOsc.frequency.setTargetAtTime(baseHz, now, 0.18);
      }
      if (this.engineSubOsc) {
        this.engineSubOsc.frequency.setTargetAtTime(baseHz * 0.5, now, 0.18);
      }
      if (this.propLfoOsc) {
        this.propLfoOsc.frequency.setTargetAtTime(11.5 + climbRatio * 7.5, now, 0.2);
      }
      if (this.engineFilter) {
        this.engineFilter.frequency.setTargetAtTime(220 + climbRatio * 180, now, 0.2);
      }
      if (this.windFilter) {
        this.windFilter.frequency.setTargetAtTime(330 + climbRatio * 340, now, 0.2);
      }
    } catch {
      // ignore
    }
  }

  public stopFlightHum() {
    const ctx = this.ctx;
    if (ctx) {
      const now = ctx.currentTime;
      if (this.engineMasterGain) {
        try {
          this.engineMasterGain.gain.setTargetAtTime(0.0001, now, 0.06);
        } catch {}
      }
      if (this.windGain) {
        try {
          this.windGain.gain.setTargetAtTime(0.0001, now, 0.06);
        } catch {}
      }
      const mainRef = this.engineMainOsc;
      const subRef = this.engineSubOsc;
      const lfoRef = this.propLfoOsc;
      const windRef = this.windSource;
      setTimeout(() => {
        [mainRef, subRef, lfoRef, windRef].forEach((node) => {
          if (node) {
            try {
              node.stop();
              node.disconnect();
            } catch {}
          }
        });
      }, 140);
    }
    this.engineMainOsc = null;
    this.engineSubOsc = null;
    this.propLfoOsc = null;
    this.propLfoGain = null;
    this.engineFilter = null;
    this.engineMasterGain = null;
    this.windSource = null;
    this.windFilter = null;
    this.windGain = null;
  }

  // Authentic Spribe Aviator bright Cashout chime
  public playCashoutWin() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [659.25, 880, 1174.66, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.09, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.24);
    });
  }

  // Realistic Aircraft Engine Stall + Doppler Fly-Away Whoosh + Crash Impact Sound
  public playCrash() {
    this.stopFlightHum();
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Engine stall & deep crash thump (155Hz -> 28Hz)
    const stallOsc = ctx.createOscillator();
    const stallFilter = ctx.createBiquadFilter();
    const stallGain = ctx.createGain();

    stallOsc.type = 'sawtooth';
    stallOsc.frequency.setValueAtTime(155, now);
    stallOsc.frequency.exponentialRampToValueAtTime(28, now + 0.65);

    stallFilter.type = 'lowpass';
    stallFilter.frequency.setValueAtTime(520, now);
    stallFilter.frequency.exponentialRampToValueAtTime(65, now + 0.65);

    stallGain.gain.setValueAtTime(0.14, now);
    stallGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    stallOsc.connect(stallFilter);
    stallFilter.connect(stallGain);
    stallGain.connect(ctx.destination);
    stallOsc.start(now);
    stallOsc.stop(now + 0.72);

    // 2. Realistic rushing turbine/propeller fly-away wind burst & impact noise
    if (this.noiseBuffer) {
      const crashNoise = ctx.createBufferSource();
      crashNoise.buffer = this.noiseBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.Q.value = 1.2;
      noiseFilter.frequency.setValueAtTime(1250, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(110, now + 0.75);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.18, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.78);

      crashNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      crashNoise.start(now);
      crashNoise.stop(now + 0.8);
    }
  }
}

export const aviatorSound = new AviatorSoundEngine();
