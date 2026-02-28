const sourceText = document.getElementById("sourceText");
const finalText = document.getElementById("finalText");
const liveText = document.getElementById("liveText");
const clearButton = document.getElementById("clearButton");

const placeholderText = "ここに確定したテキストが表示されます。";
const livePlaceholderText = "入力中のテキスト";
const renderDelayMs = 900;
const idleCommitMs = 1800;
const maxVisibleChunks = 2;
const preferredChunkLength = 120;
const maxChunkLength = 170;
const livePreviewWordLimit = 10;

let committedText = "";
let committedChunks = [];
let liveChunk = "";
let renderTimer = null;
let idleCommitTimer = null;

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function getLivePreviewText(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "";
  }

  const words = normalized.split(" ");
  if (words.length <= livePreviewWordLimit) {
    return normalized;
  }

  return words.slice(-livePreviewWordLimit).join(" ");
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

function renderDisplay() {
  if (committedChunks.length === 0) {
    finalText.textContent = placeholderText;
  } else {
    finalText.textContent = [...committedChunks].reverse().join("\n\n");
  }

  const previewText = getLivePreviewText(liveChunk);
  liveText.textContent = previewText || livePlaceholderText;
  finalText.scrollTop = 0;
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => {
    renderDisplay();
  }, renderDelayMs);
}

function scheduleIdleCommit() {
  clearTimeout(idleCommitTimer);
  idleCommitTimer = window.setTimeout(() => {
    if (normalizeText(liveChunk)) {
      commitChunk(liveChunk);
      liveChunk = "";
      renderDisplay();
    }
  }, idleCommitMs);
}

function syncFromInput(value) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    committedText = "";
    committedChunks = [];
    liveChunk = "";
    clearTimeout(renderTimer);
    clearTimeout(idleCommitTimer);
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

  scheduleRender();
  scheduleIdleCommit();
}

sourceText.addEventListener("input", () => {
  syncFromInput(sourceText.value);
});

function clearAll(event) {
  event.preventDefault();
  sourceText.value = "";
  sourceText.blur();
  syncFromInput("");
}

function updateViewportMetrics() {
  const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const nextAppHeight = Math.max(320, Math.round(viewportHeight));
  const nextDisplayHeight = Math.max(140, Math.min(260, Math.round(viewportHeight * 0.34)));

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
