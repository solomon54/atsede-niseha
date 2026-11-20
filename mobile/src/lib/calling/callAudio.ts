import { Audio } from "expo-av";

function makeRingbackWavDataUri(): string {
  const sampleRate = 8000;
  const toneSec = 2;
  const silenceSec = 3;
  const totalSamples = Math.floor(sampleRate * (toneSec + silenceSec));
  const dataSize = totalSamples * 2;
  const buffer = new Uint8Array(44 + dataSize);
  const view = new DataView(buffer.buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) buffer[off + i] = s.charCodeAt(i);
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const toneSamples = Math.floor(sampleRate * toneSec);
  for (let i = 0; i < totalSamples; i++) {
    let sample = 0;
    if (i < toneSamples) {
      const t = i / sampleRate;
      sample =
        (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 480 * t)) * 0.12;
    }
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(
      44 + i * 2,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true
    );
  }

  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(buffer.subarray(i, i + chunk)) as any
    );
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  let i = 0;
  while (i < binary.length) {
    const b1 = binary.charCodeAt(i++);
    const b2 = i < binary.length ? binary.charCodeAt(i++) : NaN;
    const b3 = i < binary.length ? binary.charCodeAt(i++) : NaN;
    const e1 = b1 >> 2;
    const e2 = ((b1 & 3) << 4) | (isNaN(b2) ? 0 : b2 >> 4);
    const e3 = isNaN(b2) ? 64 : ((b2 & 15) << 2) | (isNaN(b3) ? 0 : b3 >> 6);
    const e4 = isNaN(b3) ? 64 : b3 & 63;
    out += chars[e1] + chars[e2] + (e3 === 64 ? "=" : chars[e3]) + (e4 === 64 ? "=" : chars[e4]);
  }
  return "data:audio/wav;base64," + out;
}

let ringback: Audio.Sound | null = null;
let playing = false;
let generation = 0;

/** Caller-side ringback only. Incoming ringing is handled by the native service. */
export async function startRingback(): Promise<void> {
  if (playing) return;
  const token = ++generation;
  playing = true;
  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: makeRingbackWavDataUri() },
      { shouldPlay: true, isLooping: true, volume: 0.6 }
    );
    if (!playing || token !== generation) {
      await sound.stopAsync().catch(() => {});
      await sound.unloadAsync().catch(() => {});
      return;
    }
    ringback = sound;
  } catch {
    playing = false;
  }
}

export async function stopRingback(): Promise<void> {
  generation += 1;
  playing = false;
  const sound = ringback;
  ringback = null;
  if (!sound) return;
  await sound.stopAsync().catch(() => {});
  await sound.unloadAsync().catch(() => {});
}
