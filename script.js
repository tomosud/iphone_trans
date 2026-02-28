const sourceText = document.getElementById("sourceText");
const finalText = document.getElementById("finalText");
const clearButton = document.getElementById("clearButton");
const storageApi = window.TransStorage;

const placeholderText = "Committed text appears here. Turn on browser translation if needed.";
const idleCommitMs = 900;
const punctuationCommitMs = 280;
const maxVisibleChunks = 2;
const preferredChunkLength = 120;
const maxChunkLength = 170;
const latestSaveDelayMs = 250;

let committedText = "";
let committedChunks = [];
let liveChunk = "";
let idleCommitTimer = null;
let punctuationCommitTimer = null;
let latestSaveTimer = null;
let ignoreNextClearClick = false;

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function findSplitIndex(text) {
  if (text.length <= preferredChunkLength) {
    return -1;
  }

  const searchArea = text.slice(0, maxChunkLength);
  const punctuationMatches = [...searchArea.matchAll(/[.!?。！？]\s/g)];
  if (punctuationMatches.length > 0) {
    const match = punctuationMatches[punctuationMatches.length - 1];
    return match.index + match[0].length;
  }

  const commaIndex = Math.max(searchArea.lastIndexOf(", "), searchArea.lastIndexOf("、"));
  if (commaIndex >= preferredChunkLength * 0.6) {
    return commaIndex + 1;
  }

  const spaceIndex = searchArea.lastIndexOf(" ");
  if (spaceIndex >= preferredChunkLength * 0.6) {
    return spaceIndex;
  }

  return text.length >= maxChunkLength ? maxChunkLength : -1;
}

function commitChunk(chunkText) {
  const normalized = normalizeText(chunkText);
  if (!normalized) {
    return;
  }

  committedChunks.push(normalized);
  committedText = normalizeText(`${committedText} ${normalized}`);
  if (committedChunks.length > maxVisibleChunks) {
    committedChunks = committedChunks.slice(-maxVisibleChunks);
  }
}

function commitLiveChunk() {
  if (!normalizeText(liveChunk)) {
    return;
  }

  clearTimeout(idleCommitTimer);
  clearTimeout(punctuationCommitTimer);
  commitChunk(liveChunk);
  liveChunk = "";
  renderDisplay();
}

function endsWithSentencePunctuation(text) {
  return /[.!?。！？]$/.test(normalizeText(text));
}

function renderDisplay() {
  if (committedChunks.length === 0) {
    finalText.textContent = placeholderText;
  } else {
    finalText.textContent = [...committedChunks].reverse().join("\n\n");
  }

  finalText.scrollTop = 0;
}

function scheduleLatestSave(value) {
  clearTimeout(latestSaveTimer);
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return;
  }

  latestSaveTimer = window.setTimeout(() => {
    void storageApi.saveLatestText(normalizedValue);
  }, latestSaveDelayMs);
}

async function restoreLatestText() {
  try {
    const latest = await storageApi.getLatestText();
    if (!latest || !latest.body) {
      return;
    }

    sourceText.value = latest.body;
    syncFromInput(latest.body);
  } catch (error) {
    console.error("Failed to restore latest text.", error);
  }
}

function scheduleIdleCommit() {
  clearTimeout(idleCommitTimer);
  idleCommitTimer = window.setTimeout(() => {
    commitLiveChunk();
  }, idleCommitMs);
}

function schedulePunctuationCommit() {
  clearTimeout(punctuationCommitTimer);
  if (!endsWithSentencePunctuation(liveChunk)) {
    return;
  }

  punctuationCommitTimer = window.setTimeout(() => {
    if (endsWithSentencePunctuation(liveChunk)) {
      commitLiveChunk();
    }
  }, punctuationCommitMs);
}

function syncFromInput(value) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    committedText = "";
    committedChunks = [];
    liveChunk = "";
    clearTimeout(idleCommitTimer);
    clearTimeout(punctuationCommitTimer);
    clearTimeout(latestSaveTimer);
    renderDisplay();
    return;
  }

  if (committedText && normalizedValue.startsWith(committedText)) {
    liveChunk = normalizeText(normalizedValue.slice(committedText.length));
  } else if (!committedText) {
    liveChunk = normalizedValue;
  } else {
    committedText = "";
    committedChunks = [];
    liveChunk = normalizedValue;
  }

  let splitIndex = findSplitIndex(liveChunk);
  while (splitIndex > 0) {
    commitChunk(liveChunk.slice(0, splitIndex));
    liveChunk = normalizeText(liveChunk.slice(splitIndex));
    splitIndex = findSplitIndex(liveChunk);
  }

  scheduleIdleCommit();
  schedulePunctuationCommit();
  scheduleLatestSave(normalizedValue);
}

sourceText.addEventListener("input", () => {
  syncFromInput(sourceText.value);
});

function persistCurrentTextAsHistory(body) {
  const normalizedBody = normalizeText(body);
  if (!normalizedBody) {
    return;
  }

  clearTimeout(latestSaveTimer);
  void storageApi.saveLatestText(normalizedBody);
  void storageApi.archiveText(normalizedBody, "clear");
}

function clearAll(event) {
  event.preventDefault();
  if (event.type === "click" && ignoreNextClearClick) {
    ignoreNextClearClick = false;
    return;
  }

  if (event.type === "pointerdown") {
    ignoreNextClearClick = true;
  }

  persistCurrentTextAsHistory(sourceText.value);
  sourceText.value = "";
  sourceText.blur();
  syncFromInput("");
}

function updateViewportMetrics() {
  const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const nextAppHeight = Math.max(320, Math.round(viewportHeight));
  const nextDisplayHeight = Math.max(260, Math.min(520, Math.round(viewportHeight * 0.72)));

  document.documentElement.style.setProperty("--app-height", `${nextAppHeight}px`);
  document.documentElement.style.setProperty("--display-height", `${nextDisplayHeight}px`);
}

clearButton.addEventListener("pointerdown", clearAll);
clearButton.addEventListener("click", clearAll);

window.addEventListener("resize", updateViewportMetrics);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateViewportMetrics);
}

updateViewportMetrics();
renderDisplay();
void restoreLatestText();
