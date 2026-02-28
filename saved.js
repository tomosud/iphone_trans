const listView = document.getElementById("listView");
const detailView = document.getElementById("detailView");
const latestSection = document.getElementById("latestSection");
const latestCardContainer = document.getElementById("latestCardContainer");
const historyList = document.getElementById("historyList");
const emptyState = document.getElementById("emptyState");
const copyAllButton = document.getElementById("copyAllButton");
const listStatus = document.getElementById("listStatus");
const detailTitle = document.getElementById("detailTitle");
const detailDate = document.getElementById("detailDate");
const detailBody = document.getElementById("detailBody");
const detailStatus = document.getElementById("detailStatus");
const detailActionButtons = document.querySelectorAll("[data-action]");

const storageApi = window.TransStorage;
const params = new URLSearchParams(window.location.search);
const selectedId = params.get("id");

let activeRecord = null;
const previewLimit = 400;

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function createCard(record, href, badgeText) {
  const link = document.createElement("a");
  link.className = "saved-card";
  link.href = href;

  const meta = document.createElement("div");
  meta.className = "saved-card-meta";

  if (badgeText) {
    const badge = document.createElement("span");
    badge.className = "saved-badge";
    badge.textContent = badgeText;
    meta.appendChild(badge);
  }

  const date = document.createElement("span");
  date.className = "saved-card-date";
  date.textContent = formatDate(record.updatedAt || record.createdAt);
  meta.appendChild(date);

  const title = document.createElement("strong");
  title.className = "saved-card-title";
  title.textContent = record.title || "(no title)";

  const preview = document.createElement("p");
  preview.className = "saved-card-preview";
  preview.textContent = record.body.length > previewLimit
    ? `${record.body.slice(0, previewLimit)}...`
    : record.body;

  link.appendChild(meta);
  link.appendChild(title);
  link.appendChild(preview);

  return link;
}

function buildBulkCopyText(latest, history) {
  const items = [];

  if (latest) {
    items.push({
      date: latest.updatedAt || latest.createdAt,
      body: latest.body,
    });
  }

  for (const record of history) {
    items.push({
      date: record.updatedAt || record.createdAt,
      body: record.body,
    });
  }

  return items
    .map((item) => `${formatDate(item.date)}\n${item.body}`)
    .join("\n\n");
}

async function copyBody() {
  if (!activeRecord) {
    return;
  }

  try {
    await navigator.clipboard.writeText(activeRecord.body);
    detailStatus.textContent = "Copied.";
  } catch (error) {
    detailStatus.textContent = "Clipboard write failed.";
  }
}

async function copyAllTexts() {
  const { latest, history } = await storageApi.listSavedTexts();
  const payload = buildBulkCopyText(latest, history);

  if (!payload) {
    listStatus.textContent = "No saved texts.";
    return;
  }

  try {
    await navigator.clipboard.writeText(payload);
    listStatus.textContent = "All texts copied.";
  } catch (error) {
    listStatus.textContent = "Clipboard write failed.";
  }
}

async function deleteRecord() {
  if (!activeRecord) {
    return;
  }

  const firstConfirm = window.confirm("このテキストを削除しますか?");
  if (!firstConfirm) {
    return;
  }

  const secondConfirm = window.confirm("本当に削除します。元に戻せません。削除しますか?");
  if (!secondConfirm) {
    return;
  }

  await storageApi.deleteSavedText(activeRecord.id || "latest");
  window.location.href = "saved.html";
}

async function renderList() {
  const { latest, history } = await storageApi.listSavedTexts();

  latestCardContainer.replaceChildren();
  historyList.replaceChildren();

  if (latest) {
    latestSection.hidden = false;
    latestCardContainer.appendChild(createCard(latest, "saved.html?id=latest", "Latest"));
  } else {
    latestSection.hidden = true;
  }

  for (const record of history) {
    historyList.appendChild(createCard(record, `saved.html?id=${encodeURIComponent(record.id)}`));
  }

  const hasAnyRecord = Boolean(latest) || history.length > 0;
  emptyState.hidden = hasAnyRecord;
}

async function renderDetail(id) {
  const record = await storageApi.getSavedText(id);

  if (!record) {
    detailTitle.textContent = "Not found";
    detailDate.textContent = "";
    detailBody.textContent = "指定した保存テキストは見つかりませんでした。";
    for (const button of detailActionButtons) {
      button.disabled = true;
    }
    return;
  }

  activeRecord = {
    ...record,
    id: id === "latest" ? "latest" : record.id,
  };

  detailTitle.textContent = record.title || "(no title)";
  detailDate.textContent = formatDate(record.updatedAt || record.createdAt);
  detailBody.textContent = record.body;
}

async function initSavedPage() {
  if (selectedId) {
    listView.hidden = true;
    detailView.hidden = false;
    await renderDetail(selectedId);
    for (const button of detailActionButtons) {
      button.addEventListener("click", () => {
        if (button.dataset.action === "copy") {
          void copyBody();
          return;
        }

        if (button.dataset.action === "delete") {
          void deleteRecord();
        }
      });
    }
    return;
  }

  listView.hidden = false;
  detailView.hidden = true;
  copyAllButton.addEventListener("click", () => {
    void copyAllTexts();
  });
  await renderList();
}

void initSavedPage();
