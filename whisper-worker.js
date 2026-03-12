import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
env.useBrowserCache = true;

// Always recreate ASR pipeline for every incoming clip.
// This intentionally disables transcriber reuse to avoid stale worker/model state.
let activeTranscriber = null;

async function disposeActiveTranscriber() {
  if (!activeTranscriber) return;
  const transcriber = activeTranscriber;
  activeTranscriber = null;
  if (typeof transcriber.dispose === 'function') {
    try {
      await transcriber.dispose();
    } catch {
      // Ignore dispose failures and continue with a fresh pipeline.
    }
  }
}

async function createFreshTranscriber(modelName) {
  await disposeActiveTranscriber();
  const transcriber = await pipeline('automatic-speech-recognition', modelName, {
    progress_callback: (progress) => {
      self.postMessage({ type: 'progress', progress });
    },
  });
  activeTranscriber = transcriber;
  return transcriber;
}

self.onmessage = async (ev) => {
  const msg = ev.data || {};

  if (msg.type === 'load') {
    try {
      // Preload once for UX, but transcribe requests still rebuild every time.
      await createFreshTranscriber(msg.modelName);
      self.postMessage({ type: 'ready', modelName: msg.modelName });
    } catch (e) {
      self.postMessage({ type: 'error', id: msg.id ?? null, error: e?.message || String(e) });
    }
    return;
  }

  if (msg.type === 'transcribe') {
    const id = msg.id;
    try {
      const modelName = msg.modelName;
      const audio = msg.audio;
      const options = msg.options || {};
      const asr = await createFreshTranscriber(modelName);
      const res = await asr(audio, options);
      self.postMessage({ type: 'result', id, text: res?.text || '' });
    } catch (e) {
      self.postMessage({ type: 'error', id, error: e?.message || String(e) });
    }
  }
};
