import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
env.useBrowserCache = true;

let activeTranscriber = null;
let activeModelName = null;

async function getTranscriber(modelName, { forceReload = false } = {}) {
  const shouldReload = forceReload || !activeTranscriber || activeModelName !== modelName;
  if (!shouldReload) return activeTranscriber;

  if (activeTranscriber && typeof activeTranscriber.dispose === 'function') {
    try {
      await activeTranscriber.dispose();
    } catch {
      // Continue with a fresh pipeline.
    }
  }

  activeTranscriber = await pipeline('automatic-speech-recognition', modelName, {
    progress_callback: (progress) => {
      self.postMessage({ type: 'progress', progress });
    },
  });
  activeModelName = modelName;
  return activeTranscriber;
}

self.onmessage = async (ev) => {
  const msg = ev.data || {};

  if (msg.type === 'load') {
    try {
      await getTranscriber(msg.modelName, { forceReload: true });
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
      // Explicitly copy into a new Float32Array to handle transferred buffers
      // that may arrive detached or in a non-contiguous state in some browsers.
      const audio = new Float32Array(msg.audio);
      if (audio.length === 0) {
        self.postMessage({ type: 'result', id, text: '' });
        return;
      }
      const options = msg.options || {};
      const asr = await getTranscriber(modelName);
      const res = await asr(audio, options);
      self.postMessage({ type: 'result', id, text: res?.text || '' });
    } catch (e) {
      self.postMessage({ type: 'error', id, error: e?.message || String(e) });
    }
  }
};
