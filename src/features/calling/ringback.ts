// src/features/calling/ringback.ts

/** Outgoing ringback tone. Never started before an authoritative ringing state. */
export function createRingbackController() {
  let ctx: AudioContext | null = null;
  let interval: number | null = null;
  let activeNodes: Array<{ osc: OscillatorNode; gain: GainNode }> = [];

  const stopBurst = () => {
    activeNodes.forEach(({ osc, gain }) => {
      try {
        gain.gain.cancelScheduledValues(ctx?.currentTime || 0);
        gain.gain.setValueAtTime(0, ctx?.currentTime || 0);
        osc.stop();
      } catch {}
      try { osc.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    });
    activeNodes = [];
  };

  const playBurst = () => {
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
      gain.gain.setValueAtTime(0.06, now + 1.95);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2);
      gain.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);
      osc1.connect(gain);
      osc2.connect(gain);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2);
      osc2.stop(now + 2);
      activeNodes.push({ osc: osc1, gain }, { osc: osc2, gain });
    } catch {}
  };

  const start = async () => {
    try {
      if (typeof window === "undefined") return;
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!ctx) ctx = new AudioCtx();
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      if (interval) return;
      playBurst();
      interval = window.setInterval(() => {
        stopBurst();
        playBurst();
      }, 5000);
    } catch {}
  };

  const stop = () => {
    if (interval) {
      window.clearInterval(interval);
      interval = null;
    }
    stopBurst();
  };

  const dispose = async () => {
    stop();
    try { await ctx?.close(); } catch {}
    ctx = null;
  };

  return { start, stop, dispose };
}
