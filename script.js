const sourceText = document.getElementById("sourceText");
const displayText = document.getElementById("displayText");
const sampleButton = document.getElementById("sampleButton");
const clearButton = document.getElementById("clearButton");

const placeholderText = "ここにリアルタイム表示されます。";
const sampleText =
  "こんにちは。これは iPhone の音声入力を使って入れた文章を、下の表示欄にそのまま出すテストです。";

function syncDisplay(value) {
  const nextValue = value.trim().length > 0 ? value : placeholderText;
  displayText.textContent = nextValue;
}

sourceText.addEventListener("input", () => {
  syncDisplay(sourceText.value);
});

sampleButton.addEventListener("click", () => {
  sourceText.value = sampleText;
  syncDisplay(sourceText.value);
  sourceText.focus();
});

clearButton.addEventListener("click", () => {
  sourceText.value = "";
  syncDisplay(sourceText.value);
  sourceText.focus();
});

syncDisplay(sourceText.value);
