/**
 * Node.js Whisper test: synthesise audio snippets and measure transcription.
 * Generates: silence, sine-wave tones, and a speech-like chirp burst.
 * Prints timing + results so we can improve whisper.html accordingly.
 */

import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache  = false;   // use node cache dir instead

const SAMPLE_RATE = 16000;

// ── Audio generators ──────────────────────────────────────────────────────────

function silence(durationSec) {
    return new Float32Array(Math.round(durationSec * SAMPLE_RATE));
}

function tone(durationSec, freqHz = 440, amp = 0.5) {
    const len = Math.round(durationSec * SAMPLE_RATE);
    const buf = new Float32Array(len);
    for (let i = 0; i < len; i++) {
        buf[i] = amp * Math.sin(2 * Math.PI * freqHz * i / SAMPLE_RATE);
    }
    return buf;
}

/** Pseudo-speech: rapid chirps at speech-like frequencies with amplitude envelope */
function pseudoSpeech(durationSec) {
    const len = Math.round(durationSec * SAMPLE_RATE);
    const buf = new Float32Array(len);
    const formants = [300, 900, 2300];  // rough vowel formants
    for (let i = 0; i < len; i++) {
        const t = i / SAMPLE_RATE;
        // 4 Hz amplitude modulation (syllable rate)
        const env = 0.4 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t));
        let s = 0;
        for (const f of formants) s += Math.sin(2 * Math.PI * f * t);
        buf[i] = env * s / formants.length;
    }
    return buf;
}

/** Mix: silence prefix + pseudo-speech + silence suffix */
function withPadding(speechSec, padSec = 0.5) {
    const pre  = silence(padSec);
    const mid  = pseudoSpeech(speechSec);
    const post = silence(padSec);
    const out  = new Float32Array(pre.length + mid.length + post.length);
    out.set(pre, 0);
    out.set(mid, pre.length);
    out.set(post, pre.length + mid.length);
    return out;
}

// ── Test cases ────────────────────────────────────────────────────────────────

const CASES = [
    { name: 'pure silence (0.5s)',           audio: silence(0.5) },
    { name: 'pure silence (3s)',             audio: silence(3) },
    { name: 'sine 440Hz (2s)',               audio: tone(2, 440) },
    { name: 'sine 440Hz (5s)',               audio: tone(5, 440) },
    { name: 'pseudo-speech (1s)',            audio: withPadding(1) },
    { name: 'pseudo-speech (3s)',            audio: withPadding(3) },
    { name: 'pseudo-speech (8s)',            audio: withPadding(8) },
    { name: 'pseudo-speech (15s)',           audio: withPadding(15) },
    { name: 'pseudo-speech (28s) [near max]',audio: withPadding(28) },
];

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('Loading whisper-tiny (multilingual)…');
const t0 = Date.now();
const transcriber = await pipeline(
    'automatic-speech-recognition',
    'onnx-community/whisper-tiny',
    { progress_callback: (p) => { if (p.status === 'progress') process.stdout.write('.'); } }
);
console.log(`\nModel ready in ${((Date.now() - t0)/1000).toFixed(1)}s\n`);

const results = [];

for (const c of CASES) {
    const audioSec = (c.audio.length / SAMPLE_RATE).toFixed(1);
    process.stdout.write(`  ${c.name} (${audioSec}s audio) → `);
    const t1 = Date.now();
    try {
        const res = await transcriber(c.audio, { task: 'transcribe' });
        const elapsed = ((Date.now() - t1) / 1000).toFixed(2);
        const text = (res.text || '').trim().slice(0, 80) || '(empty)';
        console.log(`${elapsed}s  "${text}"`);
        results.push({ name: c.name, audioSec: parseFloat(audioSec), elapsed: parseFloat(elapsed), text });
    } catch (err) {
        const elapsed = ((Date.now() - t1) / 1000).toFixed(2);
        console.log(`ERROR after ${elapsed}s — ${err.message}`);
        results.push({ name: c.name, audioSec: parseFloat(audioSec), elapsed: parseFloat(elapsed), error: err.message });
    }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n── Summary ──────────────────────────────────────────────────────');
for (const r of results) {
    const ratio = r.elapsed && r.audioSec ? (r.elapsed / r.audioSec).toFixed(2) : '?';
    console.log(`  ${r.name.padEnd(35)} audio=${r.audioSec}s  proc=${r.elapsed}s  ratio=${ratio}x`);
}

const withSpeech = results.filter(r => r.name.includes('pseudo') && !r.error);
if (withSpeech.length) {
    const avgRatio = withSpeech.reduce((a, b) => a + b.elapsed / b.audioSec, 0) / withSpeech.length;
    console.log(`\n  avg proc/audio ratio (pseudo-speech): ${avgRatio.toFixed(2)}x`);
    console.log(`  → expected processing time for 5s audio: ~${(avgRatio * 5).toFixed(1)}s`);
}

console.log('\nDone.');
