const sourceText = document.getElementById("sourceText");
const displayText = document.getElementById("displayText");

const placeholderText = "ここにリアルタイム表示されます。";

function syncDisplay(value) {
  const nextValue = value.trim().length > 0 ? value : placeholderText;
  displayText.textContent = nextValue;
  displayText.scrollTop = displayText.scrollHeight;
}

sourceText.addEventListener("input", () => {
  syncDisplay(sourceText.value);
});

syncDisplay(sourceText.value);
