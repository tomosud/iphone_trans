# 引継ぎ：iPhone で音声を聞いてリアルタイム翻訳する（再挑戦）

作成: 2026-11-04。前回（2026年2〜3月）の試作の記録と、youtube_lean_english で作った翻訳の仕組みを踏まえた、再挑戦のための引継ぎ文書。

## 1. 目的

iPhone（スマホ）のブラウザだけで、目の前の英語などの音声を聞き取り、日本語訳を数秒遅れで表示する。

- 置き場所は GitHub Pages（静的サイト）。サーバーは置かない。
- 翻訳は Claude API（Anthropic）。月 $200 の API クレジットを使う。
- 品質は「リアルタイムで読めること」を優先する（全体として最良の訳を作ることが目的ではない）。

## 2. 前回の試作で分かったこと

リポジトリ: https://github.com/tomosud/iphone_trans （公開 URL: https://tomosud.github.io/iphone_trans/ ）

### 2.1 動いているもの

- **index.html（使い方 B）**: iPhone のキーボードの音声入力（ディクテーション）で入力欄に文字を入れ、表示欄に区切って出す。翻訳は Safari / Chrome のページ翻訳（Google 翻訳）に任せる。これは動く。
- **saved.html**: 入力したテキストを IndexedDB に最大300件保存。
- ビルドは `npm run build`（build.mjs）で `dist/` を作り、GitHub Actions（`.github/workflows/pages.yml`）で Pages に出す。iPhone のキャッシュ対策として CSS/JS に `?v=日時` を付けている（BUILD_AND_DEPLOY.md）。

### 2.2 Whisper（端末内の音声認識）

- `whisper.html` + `whisper-worker.js`。transformers.js v2（`@xenova/transformers@2.17.2`）で Whisper tiny/base（.en と多言語）を Web Worker で動かす。
- 自前の VAD（無音検出、約1秒の無音で区切る、最長15秒）、AGC（自動音量調整）、ソフトリミッタ、録音クリップの保存、ラジオ音源でのテストまで作り込んだ（PR #53〜#80、3月10〜12日）。
- 主な苦労: 空の認識結果（AGC の掛けすぎ、Worker に渡す音声バッファが空になる問題、AudioContext の停止）。
- **注意**: 現在の `build.mjs` の `htmlFiles` は `index.html` と `saved.html` だけで、`whisper.html` と `whisper-worker.js` が `dist/` に入らない。トップページの「Whisper ASR」へのリンクは、公開サイトでは開けない可能性が高い（要確認）。

### 2.3 Moonshine（うまくいかなかった）

Moonshine は Useful Sensors（moonshine-ai）の英語向け軽量音声認識モデル。3回試して、3回とも元に戻している。

| 時期 | 試したこと | 結果 |
|---|---|---|
| 3/10 | transformers.js v3 に上げ、`onnx-community/moonshine-tiny-ONNX` / `moonshine-base-ONNX` を Whisper の代わりに使う | モデルの読み込みエラー（`MoonshineFeatureExtractor` が無い → transformers.js 3.7.2 に上げて解消）。その後 **iPhone で実行時エラー**（コードに `out of memory` / `memory access out of bounds` / `RuntimeError` / wasm / webgpu を検出してリカバリする処理が入った）。安定化として wasm・q8・スレッド数を下げ、さらに Whisper へ自動で戻す処理を足した |
| 3/11 | 3/10 の状態を捨てて c72a646（Whisper）に戻す。続けて `@moonshine-ai/moonshine-js` の最小ページ、Web Speech API のページ、`MicrophoneTranscriber` の API に合わせる修正などを試す | API の検出エラーなどが続き、再び c72a646 に戻した |
| 3/20 | `moonshine.html` を追加（`@moonshine-ai/moonshine-js@latest` の `MicrophoneTranscriber("model/tiny")`） | 同日に取り消し（3cfa1a2）。失敗の内容は記録されていない |

**原因の見立て**（ログが残っていないので推定。再挑戦するなら最初にここを確かめる）

1. **iPhone の WASM のメモリ制限**: Safari は1タブで使えるメモリが小さく、ONNX Runtime Web で base や fp32 を動かすと落ちやすい。3/10 の `out of memory` 系エラーはこれと合う。
2. **マルチスレッドの WASM が使えない**: マルチスレッドには SharedArrayBuffer が要り、そのためにはページに COOP/COEP ヘッダーが必要。GitHub Pages ではヘッダーを付けられない（service worker で付ける方法 `coi-serviceworker` はある）。単一スレッドだと遅い。
3. **版を固定していない**: 3/20 は `@latest` を読んでいて、モデルのパス（`model/tiny`）やランタイムの読み込み先の仕様が版によって違う可能性がある。
4. **ライブラリの API の取り違え**: 3/11 に「API の検出」「文書どおりの MicrophoneTranscriber に合わせる」修正が続いた。

## 3. 再挑戦の方針（おすすめ）

**まず端末内の音声認識（Moonshine/Whisper）はやめ、動くと分かっている仕組みで最後まで通す。** 端末内の認識は後から差し替えられるようにしておく。

```
音声 ─→ 音声認識 ─→ 原文をすぐ表示 ─→ Claude で訳す ─→ 訳を表示
        (A) Web Speech API                 (Haiku で速い訳 → Sonnet で差し替え)
        (A2) クラウドのストリーミング認識（Deepgram Flux）
        (B) キーボードの音声入力（今の index.html と同じ）
        (C) 端末内モデル（Moonshine/Whisper、後回し）
```

### 3.1 音声認識

調査の結果は `docs/asr-research.md`（2026-11-04）。

- **(A) Web Speech API**（`webkitSpeechRecognition`）: iPhone の Safari と Android の Chrome で使える。途中結果（interim）が出るので、話している最中から原文を表示できる。無料で、追加のキーも要らない。**ホーム画面に追加した PWA では使えない**（caniuse・WebKit のバグ 225298。iOS 26 からはホーム画面に追加すると既定で Web アプリとして開くので、Safari のタブで使う）。iPhone では `continuous=false` にして、止まったら `onend` で自動で再開するのが定番。音声は Apple のサーバーに送られる見込み。最小ページ `speech.html` を作り、PC の Chrome で認識できることを確認済み。
- **(A2) クラウドのストリーミング認識**: (A) が駄目なとき、または PWA で使いたいときの次の候補は **Deepgram Flux**。ブラウザから WebSocket で直接つなげ（キーはサブプロトコルで渡す）、話し終わりの判定が付いている。英語専用と多言語版（日本語を含む）、約 $0.46/時、$200 の無料クレジット。キーは「文字起こし専用・期限付き」で作り、3.3 と同じくパスワードマネージャーで扱う。どのサービスも一時トークンの発行には長期のキーが要るので、サーバーなしでは「絞ったキーを置く」形になる。
- **(B) キーボードの音声入力**: 今の index.html の方式。確実に動くが、入力欄を選んでマイクを押す操作が要る。(A) が駄目なときの代わり。
- **(C) 端末内モデル**: 通信なしで動くのが利点。前回の `@moonshine-ai/moonshine-js` は終了しており（2026-08 に archived）、後継は `@moonshine-ai/moonshine-wasm@0.1.5`（マルチスレッド必須なので `coi-serviceworker` が要る）。iPhone の Safari で動いた報告はまだ無く、iOS 26 の Safari には onnxruntime-web のメモリの不具合の報告もある。再挑戦するなら版を固定し、まず PC の Chrome で動かしてから iPhone で試す。手順は `docs/asr-research.md` 3.1。

### 3.2 翻訳（Claude API をページから直接呼ぶ）

- Anthropic API はブラウザから直接呼べる（リクエストに `anthropic-dangerous-direct-browser-access: true` ヘッダーを付ける。SDK なら `dangerouslyAllowBrowser`）。サーバー不要。
- **遅延の見積もり**: 話し終わりから訳が出るまで、Haiku で約1.5〜2.5秒、Sonnet で約2.5〜4秒。話し始めからでは、発話の長さ（2〜5秒）が加わって約3〜6秒（人間の同時通訳でも2〜4秒遅れる）。内訳は「話し終わりの判定 0.3〜0.8秒、認識 0.2〜1秒、通信 0.1〜0.3秒、翻訳 Haiku 0.7〜1.5秒／Sonnet 1.5〜3秒」。
- **遅延を短く見せる**: 原文を途中結果からすぐ出す。訳は Haiku で速く出し、すぐ後に Sonnet の訳で差し替える（youtube_lean_english の「Google の仮表示 → Claude で差し替え」と同じ考え方）。
- **YouTube 版との違い**: YouTube 版は字幕データを先に全部取れたので先読みで遅延を隠せた。音声は先が分からないので、聞き終わってから訳す遅れは必ず残る。文脈は「これまでの会話」しか使えない。

### 3.3 API キーの保存（GitHub Pages で）

| 方法 | 内容 | 注意 |
|---|---|---|
| パスワードマネージャー（まずはこれ） | ページにログイン欄（ユーザー名「anthropic」、パスワード欄にキー）を置き、ブラウザに保存させる。次からは自動入力。iPhone は iCloud キーチェーンに暗号化して保存される | Android の Chrome は Credential Management API で保存・取得もできる。Safari は非対応なので自動入力頼み |
| パスキー（Face ID）で暗号化 | WebAuthn の PRF 拡張で鍵を作り、キーを暗号化して保存。使うときに Face ID で解錠 | iOS 18 以降・Android Chrome。作りは少し複雑 |
| ブラウザにそのまま保存 | localStorage | 暗号化されないので使わない |

どの方法でも次の対策をする。

- **スマホ専用のキー**を、**利用上限を付けた専用のワークスペース**で作る（漏れても被害は上限まで、そのキーだけ無効にできる）。これが一番効く。
- 外部のスクリプトを読み込まない。`<meta http-equiv="Content-Security-Policy">` で接続先を `api.anthropic.com` などに絞る（GitHub Pages はヘッダーを付けられないので meta で）。
- `tomosud.github.io/〇〇` はどのリポジトリでも同じ「tomosud.github.io」扱いで、保存したパスワードやブラウザの保存領域を共有する。他の Pages サイトで外部スクリプトを使っているなら、独自ドメイン（サブドメイン）で分ける。

## 4. youtube_lean_english から流用できるもの

リポジトリ: `C:\work\script\youtube_lean_english`（GitHub: tomosud/youtube_lean_english）。設計の詳細は `docs/subtitle-design.md`。

- **翻訳プロンプト**（`background.js` の `CLAUDE_SYSTEM`）: 字幕翻訳者のように読みやすさ優先、常体、句読点のルール、話者の交代（`new_speaker` と改行）、言いよどみの扱い、前後の行の内容を入れない。
- **構造化出力**: `output_config.format`（JSON スキーマ）で行ごとに `{ new_speaker, source, ja }` と `names` を返させる。
- **名前表**: 固有名詞の訳を最初の訳に固定して毎回渡す（人名の揺れを防ぐ）。
- **原文の補正**: 自動認識の聞き間違い・句読点を直した原文も返させる。音声認識の誤りの補正にそのまま効く。
- **失敗時の扱い**: 出力の問題は1回やり直し、API のエラーは一時停止して理由を表示。
- **モデルの比較結果**: Haiku は速く安い（1時間約 $0.05〜0.09）が、話者の分け方や書き方のルールで Sonnet に劣る。Sonnet は1時間約 $0.6〜1.0。
- **API キー**: PC では api_key_vault（Windows の資格情報マネージャー＋中継）を使ったが、Windows 専用なのでスマホでは使えない。上の 3.3 で別に考える。

## 5. 最初にやること（順番）

1. **公開サイトの現状確認**: `whisper.html` が `dist/` に入っていない件を確かめる（入れるか、リンクを外す）。
2. **iPhone で `speech.html` を確かめる**（ユーザーに依頼）: Safari のタブで、途中結果・確定結果が出るか、止まったときに自動で再開するか、ホーム画面に追加すると使えないか。確認項目は `docs/asr-research.md` 4.。駄目なら (A2) Deepgram Flux を試す。
3. **最小構成を作る**: Web Speech API で原文を出す → Haiku で訳す（キーは入力欄に手で貼る仮の形でよい）。まず PC の Chrome、次に iPhone の Safari。
4. **遅延を測る**: 話し終わり → 原文確定 → 訳の表示、の各時刻を画面に出す（youtube_lean_english のデバッグ表示と同じ考え方）。
5. **キーの保存**: パスワードマネージャー方式＋スマホ専用キー＋ワークスペースの利用上限。
6. **品質**: Haiku → Sonnet の差し替え、名前表、原文の補正を足す。
7. **余力があれば**: 端末内の音声認識（Moonshine/Whisper）を (C) として、版を固定して再挑戦。

## 6. 調査タスク：音声認識の選択肢を最新の情報で調べ直す

**2026-11-04 に実施済み。結果は `docs/asr-research.md`。** 以下は依頼の内容の記録。

2026年春（3月）に試した Moonshine は、iPhone の Safari で動かなかった（2.3 参照）。半年以上たっているので、現時点（2026年11月）の最新の情報で次を調べ直す。結果は `docs/asr-research.md` にまとめ、この文書の「3. 再挑戦の方針」と「5. 最初にやること」を必要に応じて更新する。

### 6.1 Moonshine は今の Safari で動くか

- Moonshine（moonshine-ai / Useful Sensors）の最新版（モデルの新版、`@moonshine-ai/moonshine-js`、transformers.js 対応、ストリーミング版など）の状況と、iPhone の Safari（iOS 26 世代）での動作報告・既知の問題（issue）。
- 前回の失敗の見立て（2.3）が当たっているか: iPhone の WASM メモリ制限、SharedArrayBuffer と COOP/COEP（GitHub Pages ではヘッダーを付けられない。`coi-serviceworker` で回避できるか）、版の固定、API の使い方。
- Safari の WebGPU（Safari 26 で既定有効と言われている）で、ONNX Runtime Web / transformers.js の音声認識が動くか、速さはどうか。
- 動く見込みがあるなら、版を固定した最小のページで PC の Chrome → iPhone の Safari の順に確かめる手順。

### 6.2 ほかの選択肢

それぞれ「iPhone の Safari（と、ホーム画面に追加した PWA）で動くか」「話し終わりから文字が出るまでの遅延」「精度（英語、できれば多言語）」「料金」「GitHub Pages だけで動くか（サーバーが要るか）」「API キーをブラウザに置く必要があるか」で比べる。

- **ブラウザ標準**: Web Speech API（`webkitSpeechRecognition`）の iOS での現状（連続認識、途中結果、PWA での可否、言語）。
- **端末内（ブラウザ）**: transformers.js の Whisper（WebGPU / WASM）、whisper.cpp の WASM 版、sherpa-onnx の WASM 版、Vosk のブラウザ版、そのほか最近の軽量モデル。
- **クラウドのストリーミング認識**: ブラウザから直接つなげるもの（WebSocket など）。例: OpenAI の Realtime / 文字起こし API、Deepgram、AssemblyAI、Google Cloud Speech、Azure Speech、Gladia、Speechmatics。ブラウザに置く一時的なトークンを発行できるか（長期の API キーをページに置かずに済むか）。
- **Claude 側**: Claude API が音声入力に対応しているか（2026年11月時点。対応していれば認識と翻訳を1回で済ませられる）。

### 6.3 まとめ方

- 表で比較し、「まず試すべき1つ」と「その次の候補」をおすすめとして書く。
- 出典（公式ドキュメント、リリースノート、issue）へのリンクを付け、確認できなかったことは「未確認」と書く。
- 可能なら、おすすめの方式を最小のページで実際に動かし、PC で確かめた結果も書く（iPhone での確認はユーザーに依頼する）。
