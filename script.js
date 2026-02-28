const sourceText = document.getElementById("sourceText");
const displayText = document.getElementById("displayText");
const clearButton = document.getElementById("clearButton");

const placeholderText = "ここにリアルタイム表示されます。";
const renderDelayMs = 500;
const idleCommitMs = 1400;
const maxVisibleChunks = 6;
const preferredChunkLength = 160;
const maxChunkLength = 220;

let committedText = "";
let committedChunks = [];
let liveChunk = "";
let renderTimer = null;
let idleCommitTimer = null;

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

function renderDisplay() {
  const fragments = [...committedChunks];
  const normalizedLive = normalizeText(liveChunk);
  if (normalizedLive) {
    fragments.push(normalizedLive);
  }

  if (fragments.length === 0) {
    displayText.textContent = placeholderText;
  } else {
    displayText.textContent = fragments.join("\n\n");
  }

  displayText.scrollTop = displayText.scrollHeight;
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

clearButton.addEventListener("pointerdown", clearAll);
clearButton.addEventListener("click", clearAll);

renderDisplay();
