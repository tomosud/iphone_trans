import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
env.useBrowserCache = true;

// CHANGE(C): keep one cached pipeline; recreate only when model changes.
let transcriber = null;
let loadedModelName = null;
let loadPromise = null;

async function ensureModel(modelName) {
  if (transcriber && loadedModelName === modelName) return transcriber;
  if (loadPromise && loadedModelName === modelName) return loadPromise;

  loadedModelName = modelName;
  loadPromise = pipeline('automatic-speech-recognition', modelName, {
    progress_callback: (progress) => {
      self.postMessage({ type: 'progress', progress });
    },
  }).then((p) => {
    transcriber = p;
    return p;
  }).finally(() => {
    loadPromise = null;
  });

  return loadPromise;
}

self.onmessage = async (ev) => {
  const msg = ev.data || {};

  if (msg.type === 'load') {
    try {
      await ensureModel(msg.modelName);
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
      const asr = await ensureModel(modelName);
      const res = await asr(audio, options);
      self.postMessage({ type: 'result', id, text: res?.text || '' });
    } catch (e) {
      self.postMessage({ type: 'error', id, error: e?.message || String(e) });
    }
  }
};
