// Moonshine Tiny Streaming test page.
// Library: @moonshine-ai/moonshine-wasm 0.1.5 (vendored; ?cdn=1 loads it from jsDelivr instead).
const APP_VERSION = "2026-11-04c"; // bump on every change (shown on the page, also a cache buster)
const LIB_VERSION = "0.1.5";
const params = new URLSearchParams(location.search);
const LIB_BASE = params.get("cdn") === "1"
  ? `https://cdn.jsdelivr.net/npm/@moonshine-ai/moonshine-wasm@${LIB_VERSION}/dist/`
  : new URL(`./vendor/moonshine-wasm-${LIB_VERSION}/`, import.meta.url).href;

const $ = (id) => document.getElementById(id);
// Same cache-busting query as app.js itself.
const { Resampler, resampleLinear } = await import(new URL("./resample.js" + new URL(import.meta.url).search, import.meta.url).href);
const T0 = performance.now();
const now = () => performance.now();
const sec = (t = now()) => ((t - T0) / 1000).toFixed(2);
const MB = (b) => (b / 1048576).toFixed(0) + "MB";
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// ---- log (kept in localStorage so it survives a tab crash) ----
const LS_LOG = "moonshine-test-log";
const LS_STAGE = "moonshine-test-stage";
const LS_VISITS = "moonshine-test-visits";
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

const logLines = [];
function log(msg, cls) {
  const line = `${sec()}s ${msg}`;
  logLines.push(line);
  if (logLines.length > 500) logLines.shift();
  $("log").textContent = logLines.join("\n");
  lsSet(LS_LOG, JSON.stringify({ at: new Date().toISOString(), lines: logLines.slice(-200) }));
  if (cls === "ng") console.error(line); else console.log(line);
}
function setStatus(s, cls = "") { $("status").textContent = s; $("status").className = cls; }
function setStage(stage) { lsSet(LS_STAGE, JSON.stringify({ stage, at: new Date().toISOString() })); }

// Show the previous run's log if the page ended in the middle of something (likely a crash / OOM reload).
(function showPreviousCrash() {
  let prev = null, prevLog = null;
  try { prev = JSON.parse(lsGet(LS_STAGE) || "null"); prevLog = JSON.parse(lsGet(LS_LOG) || "null"); } catch { /* ignore */ }
  if (prev && !["idle", "closed"].includes(prev.stage)) {
    const box = $("crash");
    box.style.display = "block";
    box.innerHTML = "";
    const p = document.createElement("div");
    p.textContent = `前回（${prev.at}）は「${prev.stage}」の途中でページが終わりました。タブが落ちた（メモリ不足など）可能性があります。`;
    box.appendChild(p);
    if (prevLog && prevLog.lines) {
      const d = document.createElement("details");
      d.innerHTML = "<summary>前回のログ</summary>";
      const pre = document.createElement("pre");
      pre.id = "prevlog";
      pre.textContent = prevLog.lines.join("\n");
      d.appendChild(pre);
      box.appendChild(d);
    }
  }
  setStage("idle");
})();
addEventListener("pagehide", () => setStage("closed"));
addEventListener("error", (e) => { log(`window error: ${e.message} @ ${e.filename}:${e.lineno}`, "ng"); setStatus(`エラー: ${e.message}`, "ng"); });
addEventListener("unhandledrejection", (e) => { log(`unhandledrejection: ${errText(e.reason)}`, "ng"); setStatus(`エラー: ${errText(e.reason)}`, "ng"); });
function errText(e) { return e && (e.stack || e.message) ? `${e.name || "Error"}: ${e.message}${e.code !== undefined ? ` (code ${e.code})` : ""}` : String(e); }

// ---- environment ----
let visits = [];
try { visits = JSON.parse(lsGet(LS_VISITS) || "[]"); } catch { visits = []; }
visits.push({ at: new Date().toISOString(), coi: window.crossOriginIsolated === true, sw: !!navigator.serviceWorker?.controller });
visits = visits.slice(-6);
lsSet(LS_VISITS, JSON.stringify(visits));

// Shared WebAssembly memory reserves its maximum size up front. The build asks for 4GB,
// which iOS may refuse ("Out of memory"), so on iOS we default to a 1GB cap.
const memParam = params.get("maxmem"); // MB, or "default"
const MAXMEM_MB = memParam ? (memParam === "default" ? 0 : Number(memParam)) : (isIOS ? 1024 : 0);

function showEnv() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const lines = [
    `UA: ${navigator.userAgent}`,
    `ホーム画面から起動 (standalone): ${standalone ? "はい" : "いいえ"}`,
    `secure context: ${window.isSecureContext}`,
    `crossOriginIsolated: ${window.crossOriginIsolated === true}`,
    `SharedArrayBuffer: ${typeof SharedArrayBuffer !== "undefined" ? "あり" : "なし"}`,
    `Service Worker が制御中: ${navigator.serviceWorker?.controller ? "はい" : "いいえ"}`,
    `AudioWorklet: ${typeof AudioWorkletNode !== "undefined" ? "あり" : "なし"}`,
    `hardwareConcurrency（スレッド数）: ${navigator.hardwareConcurrency ?? "不明"}`,
    `navigator.deviceMemory: ${navigator.deviceMemory ?? "不明"}`,
    `WebGPU (navigator.gpu): ${"gpu" in navigator ? "あり" : "なし"}`,
    `ページの版: ${APP_VERSION}`,
    `ライブラリ: moonshine-wasm ${LIB_VERSION}（${params.get("cdn") === "1" ? "jsDelivr" : "このサイト"}）`,
    `WASM メモリ上限: ${MAXMEM_MB ? MAXMEM_MB + "MB" : "既定（4GB）"}（?maxmem=1024 / 2048 / default で変更）`,
    `訪問の記録（crossOriginIsolated）: ${visits.map((v) => (v.coi ? "○" : "×")).join(" ")}`,
  ];
  $("env").textContent = lines.join("\n");
}
showEnv();

// ---- moonshine ----
let mw = null;          // the library module
let wasmModule = null;  // the Emscripten module
let transcriber = null;
let loadedArch = null;
let mic = null;
let sampleRun = null;
let memTimer = 0;

function setButtons() {
  const busy = !!mic || !!sampleRun;
  $("load").disabled = busy;
  $("start").disabled = !transcriber || busy;
  $("sample").disabled = !transcriber || busy;
  $("stop").disabled = !busy;
  $("arch").disabled = busy;
  $("rerun").disabled = !transcriber || busy || !recording;
}

function memInfo() {
  const parts = [];
  const buf = wasmModule?.HEAPU8?.buffer;
  if (buf) parts.push(`wasm ${MB(buf.byteLength)}`);
  if (performance.memory) parts.push(`JS heap ${MB(performance.memory.usedJSHeapSize)}`);
  return parts.join(" / ") || "不明";
}
let lastMem = "";
function startMemWatch() {
  clearInterval(memTimer);
  memTimer = setInterval(() => {
    const m = memInfo();
    if (m !== lastMem) { lastMem = m; log(`メモリ: ${m}`); }
  }, 3000);
}

async function loadLibrary() {
  if (mw) return;
  setStage("ライブラリの読み込み");
  log(`ライブラリを読み込み: ${LIB_BASE}`);
  let t = now();
  mw = await import(LIB_BASE + "index.js");
  const emscripten = await import(LIB_BASE + "moonshine.mjs");
  log(`ライブラリ読み込み完了 ${((now() - t) / 1000).toFixed(2)}s`);

  setStage("WASM の初期化");
  t = now();
  const factory = emscripten.default;
  wasmModule = await mw.loadMoonshineModule({
    factory: (args) => {
      const extra = {};
      if (MAXMEM_MB) {
        // Same initial size as the build (64MB), smaller maximum.
        extra.wasmMemory = new WebAssembly.Memory({ initial: 1024, maximum: MAXMEM_MB * 16, shared: true });
        log(`共有メモリを作成: 初期 64MB / 上限 ${MAXMEM_MB}MB`);
      }
      return factory({ ...args, ...extra });
    },
  });
  log(`WASM 初期化完了 ${((now() - t) / 1000).toFixed(2)}s（${memInfo()}）`, "ok");
  startMemWatch();
}

$("load").onclick = async () => {
  const archName = $("arch").value;
  if (transcriber && loadedArch === archName) { setStatus("読み込み済み"); return; }
  if (!window.crossOriginIsolated) {
    log("crossOriginIsolated が false。Service Worker の準備ができていない可能性", "ng");
    setStatus("crossOriginIsolated が false です。ページを再読み込みしてください（1回目は Service Worker の登録で自動的に再読み込みされます）", "ng");
    return;
  }
  $("load").disabled = true;
  try {
    await loadLibrary();
    if (transcriber) { transcriber.close(); transcriber = null; }
    setStage(`モデル ${archName} のダウンロード`);
    setStatus("モデルをダウンロード中…");
    const bar = $("progress");
    bar.hidden = false; bar.value = 0;
    let lastPct = -1;
    const t = now();
    const arch = mw.ModelArch[archName];
    const downloader = new mw.AssetDownloader({
      onProgress: (loaded, total, file) => {
        const f = total ? loaded / total : 0;
        bar.value = f;
        const pct = Math.floor(f * 10) * 10;
        if (pct !== lastPct) { lastPct = pct; log(`ダウンロード ${pct}% (${MB(loaded)}${total ? " / " + MB(total) : ""}) ${file}`); }
        setStatus(`モデルをダウンロード中… ${Math.round(f * 100)}%`);
      },
    });
    // Transcriber.load downloads every file in the manifest and then builds the model in WASM.
    transcriber = await mw.Transcriber.load({ language: "en", modelArch: arch, downloader });
    loadedArch = archName;
    bar.hidden = true;
    log(`モデル ${archName} 準備完了 ${((now() - t) / 1000).toFixed(2)}s（${memInfo()}）`, "ok");
    setStatus(`モデル ${archName} 準備完了。マイク開始かサンプル音声で試してください`);
    setStage("idle");
  } catch (e) {
    log(`読み込み失敗: ${errText(e)}`, "ng");
    if (e?.stack) log(e.stack);
    setStatus(`読み込み失敗: ${errText(e)}`, "ng");
    setStage("idle");
  } finally {
    setButtons();
  }
};

// ---- output ----
function addFinal(text, info) {
  const p = document.createElement("p");
  p.className = "final";
  p.textContent = text;
  const s = document.createElement("small");
  s.textContent = info;
  p.appendChild(s);
  $("finals").appendChild(p);
  $("out").scrollTop = $("out").scrollHeight;
}

// audioStartWall: wall-clock time (performance.now) that corresponds to stream audio time 0.
function makeListener(getAudioStartWall) {
  const firstSeen = new Map();
  return {
    onLineTextChanged: (e) => {
      const l = e.line;
      if (!firstSeen.has(l.id)) { firstSeen.set(l.id, now()); log(`最初の途中結果 (音声 ${l.startTime.toFixed(2)}s): ${l.text}`); }
      $("interim").textContent = l.text;
    },
    onLineCompleted: (e) => {
      const l = e.line;
      const t = now();
      const audioEnd = l.startTime + l.duration;
      const start = getAudioStartWall(); // null when audio is not fed in real time
      const lag = start === null ? "" : `話し終わりから ${((t - (start + audioEnd * 1000)) / 1000).toFixed(2)}s, `;
      log(`確定 (音声 ${l.startTime.toFixed(2)}〜${audioEnd.toFixed(2)}s, ${lag}処理 ${l.lastTranscriptionLatencyMs}ms): ${l.text}`);
      $("interim").textContent = "";
      if (l.text.trim()) addFinal(l.text, `${sec(t)}s${lag ? " / " + lag.slice(0, -2) : ""}`);
    },
    onError: (e) => log(`stream error: ${errText(e.error)}`, "ng"),
  };
}

// ---- recording of the raw microphone input (at the AudioContext rate) ----
const REC_MAX_SEC = 180;
let recording = null; // { rate, pcm }
function concat(chunks, total) {
  const out = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c.subarray(0, Math.min(c.length, total - o)), o); o += c.length; if (o >= total) break; }
  return out;
}
function wavBlob(pcm, rate) {
  const buf = new ArrayBuffer(44 + pcm.length * 2), dv = new DataView(buf);
  const str = (o, t) => { for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); };
  str(0, "RIFF"); dv.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE"); str(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, "data"); dv.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true);
  return new Blob([buf], { type: "audio/wav" });
}
function setRecording(rec) {
  const total = Math.min(rec.samples, rec.rate * REC_MAX_SEC);
  recording = { rate: rec.rate, pcm: concat(rec.chunks, total) };
  const url = URL.createObjectURL(wavBlob(recording.pcm, recording.rate));
  const audio = $("playback"); if (audio.src) URL.revokeObjectURL(audio.src);
  audio.src = url; audio.hidden = false;
  const a = $("savewav"); a.href = url; a.download = `moonshine-mic-${new Date().toISOString().replace(/[:.]/g, "-")}.wav`; a.hidden = false;
  log(`録音: ${(total / rec.rate).toFixed(1)}s（${rec.rate}Hz）。再生・保存・認識し直しができます`);
  setButtons();
}

// ---- microphone (own capture, so every step can be observed) ----
// Worklet: mono-mix the input and hand it over in blocks of 2048 frames.
const WORKLET_SRC = `
class Cap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(2048); this.n = 0; }
  process(inputs) {
    const ch = inputs[0];
    if (ch && ch.length && ch[0]) {
      const len = ch[0].length;
      for (let i = 0; i < len; i++) {
        let s = 0;
        for (let c = 0; c < ch.length; c++) s += ch[c][i];
        this.buf[this.n++] = s / ch.length;
        if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor("cap", Cap);
`;

$("start").onclick = async () => {
  if (!transcriber) return;
  setStage("マイクで認識");
  const useScript = $("scriptproc").checked;
  const rawAudio = $("rawaudio").checked;
  // Create and resume the AudioContext inside the tap, before any await (iOS needs the user gesture).
  const resMode = $("resampler").value;
  let ctx;
  if (resMode === "ctx16k") {
    try { ctx = new AudioContext({ sampleRate: 16000 }); }
    catch (e) { log(`16kHz の AudioContext を作れない: ${errText(e)}。フィルタ付きに切り替え`, "ng"); }
  }
  ctx ??= new AudioContext();
  const resumed = ctx.resume().catch((e) => log(`resume 失敗: ${errText(e)}`, "ng"));
  const m = (mic = { ctx, cancel: false, start: now(), stats: { samples: 0, peak: 0, sumSq: 0, n: 0, passes: 0, lines: 0, last: "" } });
  setButtons();
  setStatus("マイクを準備中…");
  const tPrep = now();
  try {
    const audio = rawAudio ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : true;
    m.media = await navigator.mediaDevices.getUserMedia({ audio });
    await resumed;
    if (ctx.state !== "running") await ctx.resume();
    const track = m.media.getAudioTracks()[0];
    log(`マイク取得 ${((now() - tPrep) / 1000).toFixed(2)}s / AudioContext: ${ctx.state} ${ctx.sampleRate}Hz / マイク: ${track?.label || "?"} muted=${track?.muted} ${JSON.stringify(track?.getSettings?.() ?? {})}`);
    track?.addEventListener("mute", () => log("マイクの track が mute になった", "ng"));
    track?.addEventListener("unmute", () => log("マイクの track の mute が解けた"));
    track?.addEventListener("ended", () => log("マイクの track が終了した", "ng"));
    ctx.onstatechange = () => log(`AudioContext の状態: ${ctx.state}`);

    m.stream = transcriber.createStream();
    m.stream.addListener(makeListener(() => m.start));
    m.stream.start();
    const rate = ctx.sampleRate;
    const resampler = resMode === "linear" ? null : new Resampler(rate);
    m.rec = { rate, chunks: [], samples: 0 };
    let prevSnap = null;
    const onChunk = (chunk) => {
      if (m.cancel) return;
      if (m.rec.samples < rate * REC_MAX_SEC) { m.rec.chunks.push(chunk); m.rec.samples += chunk.length; }
      const r = resampler ? resampler.process(chunk) : resampleLinear(chunk, rate);
      const st = m.stats;
      for (let i = 0; i < r.length; i++) { const v = Math.abs(r[i]); if (v > st.peak) st.peak = v; st.sumSq += r[i] * r[i]; }
      st.n += r.length; st.samples += r.length;
      try {
        m.stream.addAudio(r, 16000);
        const snap = m.stream.transcribe();
        if (snap !== prevSnap) {
          prevSnap = snap; st.passes++;
          st.lines = snap.lines.length;
          st.last = snap.lines.length ? snap.lines[snap.lines.length - 1].text : "";
        }
      } catch (e) {
        log(`認識エラー: ${errText(e)}`, "ng");
      }
    };
    m.src = ctx.createMediaStreamSource(m.media);
    if (!useScript && ctx.audioWorklet) {
      const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: "application/javascript" }));
      try { await ctx.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
      m.node = new AudioWorkletNode(ctx, "cap");
      m.node.port.onmessage = (ev) => onChunk(ev.data);
      m.src.connect(m.node);
      m.node.connect(ctx.destination); // outputs silence; keeps the graph running
    } else {
      m.node = ctx.createScriptProcessor(4096, 1, 1);
      m.node.onaudioprocess = (ev) => onChunk(new Float32Array(ev.inputBuffer.getChannelData(0)));
      m.src.connect(m.node);
      m.node.connect(ctx.destination);
    }
    m.start = now(); // stream audio time 0 is about here
    log(`取り込み開始: ${typeof AudioWorkletNode !== "undefined" && m.node instanceof AudioWorkletNode ? "AudioWorklet" : "ScriptProcessor"} / ${rawAudio ? "エコー除去など切" : "ブラウザ既定"} / 変換 ${resMode}（${rate}Hz → 16kHz） / モデル ${loadedArch}`);
    setStatus("認識中…（英語で話してください）");
    let tick = 0;
    m.timer = setInterval(() => {
      const st = m.stats;
      const rms = st.n ? Math.sqrt(st.sumSq / st.n) : 0;
      const line = `入力 ${(st.samples / 16000).toFixed(1)}s / 直近1秒 peak ${st.peak.toFixed(3)} rms ${rms.toFixed(4)} / 認識パス ${st.passes} / 行 ${st.lines} / 最後: ${st.last || "（なし）"}`;
      $("meter").textContent = line;
      $("meterbar").value = Math.min(1, st.peak);
      if (++tick % 5 === 0) log(line);
      st.peak = 0; st.sumSq = 0; st.n = 0;
    }, 1000);
  } catch (e) {
    log(`マイク開始失敗: ${errText(e)}`, "ng");
    setStatus(`マイク開始失敗: ${errText(e)}`, "ng");
    await stopMic();
  }
};

async function stopMic() {
  const m = mic; mic = null;
  if (!m) return;
  m.cancel = true;
  clearInterval(m.timer);
  try { m.node?.disconnect(); m.src?.disconnect(); } catch { /* ignore */ }
  m.media?.getTracks().forEach((t) => t.stop());
  if (m.stream) {
    try { m.stream.stop(); } catch (e) { log(`停止エラー: ${errText(e)}`, "ng"); }
    m.stream.close();
  }
  try { await m.ctx.close(); } catch { /* ignore */ }
  log(`マイク停止（入力 ${(m.stats.samples / 16000).toFixed(1)}s, 認識パス ${m.stats.passes}）`);
  if (m.rec?.samples) setRecording(m.rec);
  setStage("idle");
  setButtons();
}

$("stop").onclick = async () => {
  await stopMic();
  if (sampleRun) sampleRun.cancel = true;
  setStatus("停止");
  setStage("idle");
  setButtons();
};

// ---- sample file (sample_en.wav: 16 kHz mono PCM16, 11 s) ----
function parseWav(buf) {
  const dv = new DataView(buf);
  let off = 12, fmt = null, data = null;
  while (off + 8 <= dv.byteLength) {
    const id = String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
    const size = dv.getUint32(off + 4, true);
    if (id === "fmt ") fmt = { ch: dv.getUint16(off + 10, true), sr: dv.getUint32(off + 12, true), bits: dv.getUint16(off + 22, true) };
    if (id === "data") data = { off: off + 8, size };
    off += 8 + size + (size & 1);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error("16bit PCM の WAV ではありません");
  const n = Math.floor(data.size / 2 / fmt.ch);
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < fmt.ch; c++) s += dv.getInt16(data.off + (i * fmt.ch + c) * 2, true);
    pcm[i] = s / fmt.ch / 32768;
  }
  return { pcm, sr: fmt.sr };
}

// Feeds 16 kHz (or any rate) PCM through a new stream, in real time or as fast as possible.
async function runClip(pcm, sr, label, realtime, run) {
  log(`${label} ${(pcm.length / sr).toFixed(1)}s を${realtime ? "実時間で" : "一気に"}流す（モデル ${loadedArch}）`);
  setStatus(`${label}で認識中…`);
  let start = 0;
  const stream = transcriber.createStream();
  stream.addListener(makeListener(() => (realtime ? start : null)));
  stream.start();
  const chunk = Math.round(sr * 0.1);
  start = now();
  let busy = 0;
  for (let i = 0; i < pcm.length && !run.cancel; i += chunk) {
    if (realtime) {
      const wait = start + (i / sr) * 1000 - now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
    const t = now();
    stream.addAudio(pcm.subarray(i, i + chunk), sr);
    stream.transcribe();
    busy += now() - t;
    if (!realtime && (i / chunk) % 20 === 0) await new Promise((r) => setTimeout(r, 0)); // let the UI draw
  }
  const t = now();
  stream.stop();
  busy += now() - t;
  stream.close();
  const wall = (now() - start) / 1000, dur = pcm.length / sr;
  log(`${label}終了: 経過 ${wall.toFixed(2)}s, 認識の処理時間 ${(busy / 1000).toFixed(2)}s（音声 ${dur.toFixed(1)}s に対して ${(busy / 1000 / dur).toFixed(2)} 倍）`, "ok");
  setStatus(`${label}終了`);
}

async function withRun(stage, label, body) {
  if (!transcriber) return;
  const run = (sampleRun = { cancel: false });
  setButtons();
  setStage(stage);
  try { await body(run); }
  catch (e) { log(`${label}失敗: ${errText(e)}`, "ng"); setStatus(`${label}失敗: ${errText(e)}`, "ng"); }
  finally { sampleRun = null; setStage("idle"); setButtons(); }
}

$("sample").onclick = () => withRun("サンプル音声で認識", "サンプル", async (run) => {
  const res = await fetch(new URL(`../sample_en.wav?v=${APP_VERSION}`, import.meta.url));
  if (!res.ok) throw new Error(`sample_en.wav: ${res.status}`);
  const { pcm, sr } = parseWav(await res.arrayBuffer());
  await runClip(pcm, sr, "サンプル", $("realtime").checked, run);
});

$("rerun").onclick = () => withRun("録音を認識し直す", "録音の再認識", async (run) => {
  if (!recording) return;
  const mode = $("resampler").value;
  // ctx16k only applies to live capture; a recording made at another rate is filtered instead.
  const pcm16 = mode === "linear" ? resampleLinear(recording.pcm, recording.rate) : new Resampler(recording.rate).process(recording.pcm);
  log(`録音を変換: ${recording.rate}Hz → 16kHz（${mode === "linear" ? "線形補間だけ" : "フィルタ付き"}）`);
  await runClip(pcm16, 16000, "録音の再認識", false, run);
});

// ---- misc ----
$("clear").onclick = () => { $("finals").textContent = ""; $("interim").textContent = ""; };
$("copy").onclick = async () => {
  const prev = $("prevlog") ? "\n\n[前回のログ]\n" + $("prevlog").textContent : "";
  const text = $("env").textContent + "\n\n" + logLines.join("\n") + prev;
  try { await navigator.clipboard.writeText(text); setStatus("ログをコピーしました"); }
  catch { setStatus("コピーできませんでした（ログを長押しで選択してください）", "ng"); }
};
$("purge").onclick = async () => {
  try {
    const ok = await caches.delete("moonshine-models-v1");
    log(`モデルのキャッシュを削除: ${ok ? "削除した" : "無かった"}`);
    setStatus("モデルのキャッシュを消しました（次の読み込みで再ダウンロード）");
  } catch (e) { log(`キャッシュ削除失敗: ${errText(e)}`, "ng"); }
};

log(`ページ読み込み（版 ${APP_VERSION}, crossOriginIsolated=${window.crossOriginIsolated === true}）`);
if (!window.crossOriginIsolated) {
  setStatus(navigator.serviceWorker ? "Service Worker を準備中…（自動で再読み込みされます。されない場合は手動で再読み込み）" : "Service Worker が使えません（プライベートブラウズ？）", "ng");
}
setButtons();
