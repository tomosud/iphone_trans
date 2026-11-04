// Resampling to 16 kHz for the speech model.
//
// The microphone runs at 44.1/48 kHz. Dropping to 16 kHz by plain linear
// interpolation lets everything above 8 kHz fold back into the speech band
// (aliasing), which adds noise that the model hears but the sample WAV
// (already 16 kHz) never had. Resampler low-pass filters first.

/** Linear interpolation only (no filter). Stateless per chunk. */
export function resampleLinear(input, rate, outRate = 16000) {
  if (rate === outRate) return input;
  const ratio = rate / outRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio, idx = Math.floor(pos), frac = pos - idx;
    const a = input[idx] ?? 0, b = input[idx + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

/** Windowed-sinc (Blackman) low-pass taps; cutoff is a fraction of the sample rate. */
function lowpassTaps(numTaps, cutoff) {
  const h = new Float32Array(numTaps);
  const m = numTaps - 1;
  let sum = 0;
  for (let i = 0; i < numTaps; i++) {
    const x = i - m / 2;
    const sinc = x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / m) + 0.08 * Math.cos((4 * Math.PI * i) / m);
    h[i] = sinc * w;
    sum += h[i];
  }
  for (let i = 0; i < numTaps; i++) h[i] /= sum;
  return h;
}

/**
 * Streaming low-pass + resample. Keeps state between chunks, so feeding the
 * microphone in pieces gives the same result as one long buffer.
 */
export class Resampler {
  constructor(rate, outRate = 16000, { numTaps = 191, cutoffHz = 7200 } = {}) {
    this.rate = rate;
    this.step = rate / outRate;
    this.passthrough = rate === outRate;
    this.h = lowpassTaps(numTaps, cutoffHz / rate);
    this.half = (numTaps - 1) / 2;
    this.buf = new Float32Array(this.half); // zero history so output starts at time 0
    this.t = this.half;                     // next output position, in buf coordinates
  }

  filteredAt(x, i) {
    const h = this.h, base = i - this.half;
    let s = 0;
    for (let k = 0; k < h.length; k++) s += h[k] * x[base + k];
    return s;
  }

  process(chunk) {
    if (this.passthrough) return chunk;
    const x = new Float32Array(this.buf.length + chunk.length);
    x.set(this.buf, 0);
    x.set(chunk, this.buf.length);
    const out = [];
    for (;;) {
      const i = Math.floor(this.t), frac = this.t - i;
      if (i + 1 + this.half >= x.length) break;
      const a = this.filteredAt(x, i);
      out.push(frac === 0 ? a : a + (this.filteredAt(x, i + 1) - a) * frac);
      this.t += this.step;
    }
    const keepFrom = Math.max(0, Math.floor(this.t) - this.half);
    this.buf = x.slice(keepFrom);
    this.t -= keepFrom;
    return Float32Array.from(out);
  }
}
