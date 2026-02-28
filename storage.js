(function attachTransStorage(global) {
  const DB_NAME = "iphoneTransStorage";
  const DB_VERSION = 1;
  const HISTORY_STORE = "history";
  const STATE_STORE = "state";
  const LATEST_KEY = "latest";
  const MAX_TOTAL_ITEMS = 300;
  const MAX_HISTORY_ITEMS = MAX_TOTAL_ITEMS - 1;

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = global.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error);
      };

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(HISTORY_STORE)) {
          const historyStore = db.createObjectStore(HISTORY_STORE, { keyPath: "id" });
          historyStore.createIndex("createdAt", "createdAt", { unique: false });
        }

        if (!db.objectStoreNames.contains(STATE_STORE)) {
          db.createObjectStore(STATE_STORE, { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }

  async function withTransaction(storeNames, mode, work) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeNames, mode);
      let workResult;

      transaction.oncomplete = () => {
        resolve(workResult);
        db.close();
      };

      transaction.onerror = () => {
        reject(transaction.error);
        db.close();
      };

      transaction.onabort = () => {
        reject(transaction.error);
        db.close();
      };

      Promise.resolve()
        .then(() => work(transaction))
        .then((result) => {
          workResult = result;
        })
        .catch((error) => {
          transaction.abort();
          reject(error);
        });
    });
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function createTitle(body) {
    return normalizeText(body).slice(0, 20);
  }

  function createHistoryRecord(body, reason) {
    const timestamp = new Date().toISOString();
    return {
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      reason,
      title: createTitle(body),
      body: normalizeText(body),
    };
  }

  function createLatestRecord(body) {
    const timestamp = new Date().toISOString();
    return {
      key: LATEST_KEY,
      updatedAt: timestamp,
      title: createTitle(body),
      body: normalizeText(body),
    };
  }

  async function pruneHistory(transaction) {
    const historyStore = transaction.objectStore(HISTORY_STORE);
    const records = await requestToPromise(historyStore.getAll());
    records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    const overflow = records.slice(MAX_HISTORY_ITEMS);
    for (const record of overflow) {
      historyStore.delete(record.id);
    }
  }

  async function saveLatestText(body) {
    const normalizedBody = normalizeText(body);
    if (!normalizedBody) {
      return null;
    }

    const record = createLatestRecord(normalizedBody);

    return withTransaction([STATE_STORE], "readwrite", async (transaction) => {
      const stateStore = transaction.objectStore(STATE_STORE);
      const existing = await requestToPromise(stateStore.get(LATEST_KEY));
      if (existing && existing.body === normalizedBody) {
        return existing;
      }

      stateStore.put(record);
      return record;
    });
  }

  async function getLatestText() {
    return withTransaction([STATE_STORE], "readonly", async (transaction) => {
      const request = transaction.objectStore(STATE_STORE).get(LATEST_KEY);
      const record = await requestToPromise(request);
      return record && record.body ? record : null;
    });
  }

  async function archiveText(body, reason = "clear") {
    const normalizedBody = normalizeText(body);
    if (!normalizedBody) {
      return null;
    }

    const record = createHistoryRecord(normalizedBody, reason);

    return withTransaction([HISTORY_STORE], "readwrite", async (transaction) => {
      const historyStore = transaction.objectStore(HISTORY_STORE);
      const existingRecords = await requestToPromise(historyStore.getAll());
      const matchedRecord = existingRecords.find((item) => item.body === normalizedBody);

      if (matchedRecord) {
        return matchedRecord;
      }

      historyStore.put(record);
      await pruneHistory(transaction);
      return record;
    });
  }

  async function listSavedTexts() {
    return withTransaction([STATE_STORE, HISTORY_STORE], "readonly", async (transaction) => {
      const latestRequest = transaction.objectStore(STATE_STORE).get(LATEST_KEY);
      const historyRequest = transaction.objectStore(HISTORY_STORE).getAll();
      const latest = await requestToPromise(latestRequest);
      const history = await requestToPromise(historyRequest);

      history.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

      return {
        latest: latest && latest.body ? latest : null,
        history,
      };
    });
  }

  async function getSavedText(id) {
    if (id === LATEST_KEY) {
      return getLatestText();
    }

    return withTransaction([HISTORY_STORE], "readonly", async (transaction) => {
      const request = transaction.objectStore(HISTORY_STORE).get(id);
      const record = await requestToPromise(request);
      return record || null;
    });
  }

  async function deleteSavedText(id) {
    const storeName = id === LATEST_KEY ? STATE_STORE : HISTORY_STORE;
    const key = id === LATEST_KEY ? LATEST_KEY : id;

    await withTransaction([storeName], "readwrite", async (transaction) => {
      transaction.objectStore(storeName).delete(key);
    });
  }

  global.TransStorage = {
    archiveText,
    deleteSavedText,
    getLatestText,
    getSavedText,
    listSavedTexts,
    saveLatestText,
  };
})(window);
