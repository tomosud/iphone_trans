# 音声認識の選択肢の調査（2026年11月）

調査日: 2026-11-04。`HANDOFF.md` の「6. 調査タスク」の結果。前提は「iPhone のブラウザだけで、聞こえた英語などを数秒遅れで日本語訳する。置き場所は GitHub Pages（サーバーなし）。翻訳は Claude API をページから直接呼ぶ」。

調べ方: 公式ドキュメント、npm の登録情報、GitHub の issue / リリース、WebKit のブログ・バグ管理、caniuse / MDN の互換性データを Web で確認した。実機の iPhone では試していない。npm の版と caniuse の注記は自分で取得し直して確かめた。それ以外は調べた範囲で出典を付けた。確かめられなかったことは **未確認** と書いた。

> 注: caniuse には iOS Safari 27.0〜27.2 がすでに載っている。iOS 27 は 2026年9月に出ているので、手元の iPhone は iOS 26 ではなく 27 の可能性がある（[caniuse のデータ](https://raw.githubusercontent.com/Fyrd/caniuse/main/features-json/speech-recognition.json)）。

## 1. 結論（おすすめ）

| 順番 | 方式 | 理由 |
|---|---|---|
| **まず試す1つ** | **Web Speech API（`webkitSpeechRecognition`）を Safari のタブで使う** | 無料。追加のキーもサーバーも要らない。途中結果が出る。PC の Chrome で動くことを確認した（下の 4.）。iPhone の Safari のタブでは対応している（caniuse）。**ホーム画面に追加した Web アプリ（PWA）では使えない**ので、Safari のタブで開いて使う |
| **次の候補** | **Deepgram Flux（クラウドのストリーミング認識）** | ブラウザから WebSocket で直接つなげる方法が公式にある。話し終わりの判定が付いていて、文の区切りで Claude に渡しやすい。英語専用と多言語版（日本語を含む10言語）がある。$200 の無料クレジット（1日1時間で1年以上）。「文字起こしだけ」「期限付き」のキーを作ってページに置ける。PWA でも使える見込み |
| 後回し | 端末内の認識（Moonshine / Whisper） | Moonshine の JS 版は作り直された（`moonshine-js` は終了 → `moonshine-wasm`）。ただし iPhone の Safari で動いたという報告は見つからない。iOS 26 の Safari には ONNX Runtime Web のメモリの不具合の報告もある。動けば通信なしにできるが、まだ「試してみないと分からない」段階 |

Claude API は今も音声を受け付けない（下の 3.4）。認識と翻訳を Claude 1回で済ませることはできない。

## 2. 比較表

凡例: ○ できる / △ 条件付き / × できない / ? 未確認

| 方式 | iPhone Safari（タブ） | ホーム画面の PWA | 遅延（話し終わり→文字） | 精度・言語 | 料金 | GitHub Pages だけで動く | ブラウザに置くキー |
|---|---|---|---|---|---|---|---|
| Web Speech API | ○（Siri が有効なこと） | **×** | 途中結果は約1秒（PC で確認）、確定は句ごと | Apple の音声入力相当。1回に1言語（`lang` で指定） | 無料 | ○ | なし |
| Deepgram Flux | ○ の見込み（WebSocket＋マイク） | ○ の見込み | 話し終わりの判定込みで短い（数値は未確認） | 英語専用 / 多言語（日本語を含む10言語、自動判定） | 約 $0.46/時（$200 無料） | ○ | 期限付き・文字起こし専用キー（作り方の細部は一部未確認） |
| Soniox `stt-rt-v6` | ○ の見込み | ○ の見込み | 短い（未確認） | 60以上の言語、**翻訳も込み** | 約 $0.12/時 | ○ | キー（権限を絞れるかは未確認）か一時キー（発行にキーが要る） |
| Speechmatics | ○ の見込み | ○ の見込み | 未確認 | 多言語 | $0.45〜0.80/時（$100 無料） | ○ | 最長24時間の一時キー（毎日手で発行して貼る） |
| OpenAI `gpt-live-transcribe` | ○ の見込み（WebRTC） | ○ の見込み | 調整可能。話し終わりはページ側で判定が要る | 多言語（言語数は未確認） | 約 $1.0/時 | △（一時キーの発行に鍵を持つ側が要る） | 一時キー（発行はサーバーから） |
| AssemblyAI Universal-Streaming | ○ の見込み | ○ の見込み | 未確認 | 英語 / 多言語（日本語は未確認） | 約 $0.15/時（接続中ずっと課金） | △ | 一時トークン（発行にサーバーが要る） |
| Gemini Live API | ○ の見込み | ○ の見込み | 未確認 | 99言語。翻訳専用モデルもある | 音声入力 $0.005/分＋出力 | △ | 一時トークン（発行にサーバーが要る） |
| Azure / ElevenLabs / Gladia | ○ の見込み | ○ の見込み | 未確認 | 多言語 | $0.39〜1/時程度 | △ | 一時トークン（発行にサーバーが要る） |
| Google Cloud Speech v2 | × | × | – | – | – | ×（gRPC だけ。中継サーバーが要る） | – |
| Moonshine（`moonshine-wasm`） | ?（報告なし） | ?（動けば ○） | 速い見込み（未確認） | 英語。日本語などは別モデル | 無料 | △（`coi-serviceworker` が要る） | なし |
| transformers.js Whisper / Moonshine | ?（iOS で落ちる報告あり） | ?（動けば ○） | 数秒（未確認） | Whisper は多言語 | 無料 | ○（単一スレッドなら） | なし |
| sherpa-onnx WASM | ?（報告なし） | ?（動けば ○） | 速い（ストリーミング、未確認） | 英語・中国語が中心 | 無料 | ○（スレッドを使わない版） | なし |
| whisper.cpp WASM | △（動く・動かないの両方の報告） | ? | 遅め | 多言語 | 無料 | △（`coi-serviceworker` が要る） | なし |
| Vosk（ブラウザ版） | ? | ? | – | – | 無料 | ○ | なし（ただし2022年から更新なし） |

料金は 1日1時間（月30時間）なら Deepgram 約 $14、Soniox 約 $3.6、OpenAI 約 $31。どれも Claude の翻訳代より小さいか同じくらい。

## 3. 調べた内容

### 3.1 Moonshine は今の Safari で動くか

**分かったこと**

- **前回使った `@moonshine-ai/moonshine-js` は終了している。** 最後の版は 0.1.29（2025-07-03）で、2026年3月の `@latest` もこの版を読んでいた。リポジトリは 2026-08-15 に保存専用（archived）になり、README は本体リポジトリの JavaScript 対応へ移るよう書いている（[npm](https://registry.npmjs.org/@moonshine-ai/moonshine-js)、[GitHub](https://github.com/moonshine-ai/moonshine-js)）。
- **後継は `@moonshine-ai/moonshine-wasm`。** 最新は 0.1.5（2026-08-24）。C++（ONNX Runtime）を Emscripten で WASM にしたもので、onnxruntime-web や transformers.js は使わない（[npm](https://registry.npmjs.org/@moonshine-ai/moonshine-wasm)、[作者のブログ 2026年8月](https://petewarden.com/2026/08/)）。
  - API は `new MicTranscriber().language('en').modelArch(ModelArch.TinyStreaming).onText(...).onLine(...).onError(...)` のあと `await mic.load(); await mic.start();`（[型定義](https://cdn.jsdelivr.net/npm/@moonshine-ai/moonshine-wasm@0.1.5/dist/mic-transcriber.d.ts)）。前回の `MicrophoneTranscriber("model/tiny")` とはまったく違う。
  - **SharedArrayBuffer（マルチスレッド）が必須**で、ページに COOP/COEP が要る。npm に入っているのはマルチスレッド版の `moonshine.wasm`（13.2MB）だけ。単一スレッド版は自分でビルドしないと無い（[README](https://cdn.jsdelivr.net/npm/@moonshine-ai/moonshine-wasm@0.1.5/README.md)）。
  - モデルは `download.moonshine.ai` から読む。COEP の下でこの読み込みが通るかは **未確認**（通らなければモデルを自分のサイトに置く）。
  - issue に Safari / iOS の話は1件も無い（[検索結果](https://github.com/moonshine-ai/moonshine/issues?q=is%3Aissue+safari)）。**iPhone の Safari で動いたという報告は見つからなかった。**
- **モデル**: Moonshine v2（ストリーミング版、tiny 34M / small 123M / medium 245M、英語、2026年2月、[論文](https://arxiv.org/abs/2602.12241)）。日本語などの単一言語版「Flavors of Moonshine」もある（[論文](https://arxiv.org/abs/2509.02523)、[moonshine-tiny-ja](https://huggingface.co/UsefulSensors/moonshine-tiny-ja)）。
- **transformers.js** は v3.2.0 から Moonshine に対応。最新は 4.3.2（2026-10-28）。4.3.0 で Moonshine の出力の不具合が直り、Safari 26 以降の WebGPU が有効になった（[リリース](https://github.com/huggingface/transformers.js/releases)、[PR #1700](https://github.com/huggingface/transformers.js/pull/1700)）。ストリーミング版の Moonshine は transformers.js では使えない。

**前回の失敗の見立て（HANDOFF.md 2.3）の答え合わせ**

| 見立て | 判定 | 根拠 |
|---|---|---|
| 1. iPhone の WASM のメモリ制限 | **ほぼ当たり（さらに不具合が重なっていた可能性）** | iPhone 16 Pro Max で1タブ約 2GB で強制終了される報告（[transformers.js #1827](https://github.com/huggingface/transformers.js/issues/1827)）。さらに **iOS 26 の Safari で onnxruntime-web 1.21 以降の CPU・メモリが異常に増える不具合**（[onnxruntime #26827](https://github.com/microsoft/onnxruntime/issues/26827)、1.20 系に戻すと避けられるとの報告）と、WebKit 側の WASM コンパイル時のメモリの不具合（[WebKit 304810](https://bugs.webkit.org/show_bug.cgi?id=304810)、2026年9月の iOS 26.6.2 でも再現）。3月の transformers.js 3.7.2 は onnxruntime-web 1.22 系なので、これに当たっていた可能性が高い（推定） |
| 2. SharedArrayBuffer と COOP/COEP | **3/20 の `moonshine-js` には当たらない。新しい `moonshine-wasm` には必須** | Safari は 15.2 から COOP/COEP に対応（[WebKit](https://webkit.org/blog/12140/new-webkit-features-in-safari-15-2/)）。GitHub Pages では [`coi-serviceworker`](https://github.com/gzuidhof/coi-serviceworker) で回避できるが、初回に1回再読み込みが入る。Safari では2回目以降に `crossOriginIsolated` が false に戻る報告があり、`window.coi = { coepCredentialless: () => false }` を先に置くと直るとの例がある（[例](https://github.com/KouyaOkamoto/useClaude/pull/16)、ただし Chromium でしか確かめていない）。iPhone での確認は **未確認** |
| 3. 版を固定していない（`@latest`） | **当たり（ただし原因の中心ではない）** | `moonshine-js` の `@latest` は 2025年7月の最後の版のまま。依存の onnxruntime-web が `^1.22.0` と幅を持っていたので、読み込まれる版がぶれた可能性はある |
| 4. API の取り違え | **一部当たり** | 前回の API は旧ライブラリのもので、ライブラリ自体がもう使われていない。今は API がまったく別 |

**Safari の WebGPU**

- iOS / iPadOS の Safari 26.0 で WebGPU は既定で有効（[WebKit](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)）。transformers.js も 4.3.0 で対応した。
- ただし iOS で WebGPU を使うと、transformers.js はメモリを多く使う版（asyncify）の ONNX Runtime を読む。asyncify 版は Safari で最大 2.2GB まで使った報告がある（[#1835](https://github.com/huggingface/transformers.js/issues/1835)）。WebGPU のメモリが増え続けて落ちる WebKit の不具合もある（[303203](https://bugs.webkit.org/show_bug.cgi?id=303203)）。**メモリの問題は WebGPU でも避けられない。**
- iPhone で Whisper / Moonshine を WebGPU で動かした速さの測定は見つからなかった（**未確認**）。Whisper のデモが iOS で動かない issue は開いたまま（[#1298](https://github.com/huggingface/transformers.js/issues/1298)）。
- Safari 27 では JSPI（メモリの少ない版の前提）が入った（[WebKit](https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/)）。onnxruntime-web 1.31.1 には JSPI 版がある。iOS 27 ならメモリの状況は良くなっている可能性があるが **未確認**。

**再挑戦する場合の手順（後回しの (C) として）**

- 案 A: `@moonshine-ai/moonshine-wasm@0.1.5` を版固定で使う。
  1. `dist/` の中身をリポジトリに置く（CDN から読まない。Worker を同じ場所から作るため）。
  2. サイトの一番上に `coi-serviceworker.js` を置き、その前に `window.coi = { coepCredentialless: () => false }` を書く。
  3. 1回目と2回目の訪問の両方で `crossOriginIsolated === true` を画面に出して確かめる。
  4. `ModelArch.TinyStreaming` から始め、`onError` / `onProgress` を画面に出す。
  5. PC の Chrome で動かしてから iPhone の Safari で試す。
- 案 B: `@huggingface/transformers@4.3.2` を版固定で使う。`device: 'wasm'`、`env.backends.onnx.wasm.numThreads = 1`（COOP/COEP 不要）、`onnx-community/moonshine-tiny-ONNX` を q8 で。iOS では WebGPU を使わない。落ちるなら onnxruntime-web 1.20 系か、iOS 27 なら JSPI 版を試す。

### 3.2 Web Speech API（ブラウザ標準）

- **iPhone の Safari**: `webkitSpeechRecognition`（接頭辞付き）で対応。Siri が有効なことが条件。iOS 26.0〜27.2 まで同じ扱い（[caniuse](https://raw.githubusercontent.com/Fyrd/caniuse/main/features-json/speech-recognition.json)）。
- **ホーム画面の PWA では使えない**: caniuse の注記に「SafariViewController とホーム画面に追加した Web アプリでは使えない」とある。WebKit のバグ（[225298](https://bugs.webkit.org/show_bug.cgi?id=225298)）は「後で対応」のまま止まっている。Apple の開発者フォーラムにも同じ報告がある（[748048](https://developer.apple.com/forums/thread/748048)）。iOS 26 からはホーム画面に追加したサイトが既定で Web アプリとして開くので、**ホーム画面には追加せず Safari のタブで使う**。iOS 26 / 27 で直ったかは **未確認**（実機で `speech.html` を開けば分かる）。
- **連続認識と途中結果**: MDN では Safari の `interimResults` は 14.1 から、`continuous` は 17 から対応（[MDN のデータ](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/SpeechRecognition.json)）。ただ iOS では勝手に止まる・`continuous: true` で詰まるとの報告があり、`continuous=false` にして `onend` で自動的に再開するのが定番の回避策（[2026年1月の記事](https://lilting.ch/en/articles/ios-webspeech-api-tips)）。60秒で止まるといった決まった上限の公式情報は **未確認**。
- **既知の不具合**: iOS 15 で途中結果と確定結果が重複する・`isFinal` が true にならない報告（[694847](https://developer.apple.com/forums/thread/694847)）。iOS 26 で直っているかは **未確認**。
- **音声の送り先**: Safari は端末内で処理するオプション（`processLocally`）に対応していない（MDN）。macOS 26 の Safari の試験では「Apple に送る」旨の確認が出て、通信なしでは動かなかった（[addpipe 2026年8月](https://blog.addpipe.com/apple-speechanalyzer-api.md)）。iPhone でも Apple のサーバーに送っていると考えられる（**未確認**）。Safari 26 からは HTTPS のページでだけ使える（GitHub Pages は HTTPS なので問題ない）。
- **言語**: 1回の認識で1言語（`lang` で指定）。自動で言語を判定する仕組みは無い（**未確認**）。
- **Chrome（参考）**: PC は 139 から接頭辞なしで対応し、端末内処理（`processLocally`）、音声トラックを渡す `start(track)` もある。Android の Chrome は `continuous` が効かない（MDN）。

### 3.3 端末内（ブラウザ）のほかの選択肢

- **transformers.js の Whisper**: 4.3.2 で WebGPU / WASM とも使える。whisper-base の q4 で約 40MB。リアルタイムのデモ（[Xenova/realtime-whisper-webgpu](https://huggingface.co/spaces/Xenova/realtime-whisper-webgpu)）はあるが、iPhone で動いた報告は見つからない。3.1 のメモリの問題をそのまま受ける。前回の whisper.html（transformers.js v2）を 4.3.2 に上げるなら、`numThreads = 1` と wasm から。
- **whisper.cpp の WASM**: リアルタイム版（`stream.wasm`）はマルチスレッドで、最初から 1GB のメモリを取るビルド。COOP/COEP が要る（[CMakeLists](https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/stream.wasm/CMakeLists.txt)）。スマホでは「動かない」「動いた」の両方の報告（[discussion #2426](https://github.com/ggml-org/whisper.cpp/discussions/2426)）。iPhone 向けには勧めない。
- **sherpa-onnx の WASM**: 本物のストリーミング認識（Zipformer / Paraformer）の英語デモがある（[英語デモ](https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-en)、[一覧](https://k2-fsa.github.io/sherpa/onnx/wasm/hf-spaces.html)）。ビルドはスレッドを使わない（SIMD のみ）ので COOP/COEP 不要、GitHub Pages だけで動く（[ビルドスクリプト](https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/build-wasm-simd-asr.sh)）。標準の構成は英中2言語のモデルで約 199MB と重い。iPhone での認識の報告は見つからない（**未確認**）。端末内で再挑戦するなら Moonshine と並ぶ候補。まず iPhone の Safari で上の英語デモを開いてみるのが早い。
- **Vosk（ブラウザ版）**: npm の版が 2022年12月の 0.0.8 のまま。実質止まっている（[GitHub](https://github.com/ccoreilly/vosk-browser)）。使わない。
- **最近の大きいモデル**: Voxtral Mini Realtime（transformers.js 4.0 から対応、約 1.5GB 以上、Chrome / Edge 向け）、Parakeet（約 2.5GB、Safari は「制限あり」）は iPhone には大きすぎる。

### 3.4 クラウドのストリーミング認識

**共通の問題**: どのサービスも、短期間の一時トークンを発行するには長期のキーを持った側（＝サーバー）から発行 API を呼ぶ必要がある。サーバーなしでは次のどれかになる。

1. 権限と期限を絞ったキーをページに貼る（パスワードマネージャーに保存。HANDOFF.md 3.3 と同じ扱い）。
2. 長めの一時トークンを毎日手で発行して貼る（Speechmatics は最長24時間）。
3. Cloudflare Workers などの小さな関数を置く（厳密にはサーバー）。

| サービス | ブラウザからのつなぎ方 | 一時トークン | 料金 | 出典 |
|---|---|---|---|---|
| Deepgram Flux（`flux-general-en` / `flux-general-multi`） | WebSocket。キーをサブプロトコル（`token, <KEY>`）で渡す方法が公式にある | `/v1/auth/grant`（最長1時間）。キー自体を「文字起こしだけ」「期限付き」で作れる（細部は一部未確認） | Flux 約 $0.0077/分（約 $0.46/時）、$200 無料 | [サブプロトコル](https://developers.deepgram.com/docs/using-the-sec-websocket-protocol)、[一時トークン](https://developers.deepgram.com/guides/fundamentals/token-based-authentication)、[多言語](https://developers.deepgram.com/docs/flux/language-prompting)、[料金](https://deepgram.com/pricing) |
| Soniox `stt-rt-v6` | WebSocket。キーをプロトコル一覧で渡せる | 一時キー（発行にキーが要る。最長1時間は未確認） | $0.12/時（翻訳込み） | [WebSocket API](https://docs.soniox.com/stt/api-reference/websocket-api)、[翻訳](https://docs.soniox.com/stt/rt/real-time-translation)、[料金](https://soniox.com/pricing) |
| Speechmatics | WebSocket（`?jwt=`） | 一時キー 60秒〜24時間 | $0.45〜0.80/時、$100 無料 | [認証](https://docs.speechmatics.com/get-started/authentication)、[料金](https://www.speechmatics.com/pricing) |
| OpenAI `gpt-live-transcribe`（2026-07 公開） | WebRTC（WebSocket もサブプロトコルで可） | `/v1/realtime/client_secrets`（10秒〜2時間） | $0.017/分（約 $1/時） | [文字起こしガイド](https://developers.openai.com/api/docs/guides/realtime-transcription)、[一時キー](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create)、[料金](https://developers.openai.com/api/docs/pricing) |
| AssemblyAI Universal-Streaming | WebSocket（`?token=`） | 1〜600秒 | $0.15/時（接続中ずっと課金）、$50 無料 | [一時トークン](https://www.assemblyai.com/docs/temporary-tokens.md)、[料金](https://www.assemblyai.com/pricing) |
| Gemini Live API | WebSocket（`?access_token=`） | 一時トークン（既定30分） | 音声入力 $0.005/分＋出力 | [一時トークン](https://aistudio.google.com/docs/live-api/ephemeral-tokens)、[翻訳モデル](https://aistudio.google.com/docs/live-api/live-translate)、[料金](https://aistudio.google.com/docs/pricing) |
| Azure Speech | JS SDK（`fromAuthorizationToken`） | 10分 | 月5時間無料（通常料金は未確認） | [トークン](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short)、[料金](https://azure.microsoft.com/en-us/pricing/details/speech/) |
| ElevenLabs Scribe v2 Realtime | WebSocket | 使い捨て15分 | $0.39/時 | [トークン](https://elevenlabs.io/docs/api-reference/tokens/create) |
| Gladia `solaria-1` | WebSocket | サーバーで `/v2/live` を呼んで URL を発行 | €0.68/時 | [始め方](https://docs.gladia.io/chapters/live-stt/getting-started) |
| Google Cloud Speech v2 | gRPC だけ。ブラウザから直接は不可 | – | – | [ストリーミング](https://cloud.google.com/speech-to-text/v2/docs/streaming-recognize) |

料金の数値はどれも各社の料金ページ（2026年11月4日に確認、ページに日付の無いものもある）。

**Claude API の音声入力**: 対応していない。Messages API のユーザー入力は `text` / `image` / `document` / `search_result` とツール関係だけで、音声のブロックは無い（[Messages API](https://platform.claude.com/docs/en/api/messages/create)、[機能一覧](https://platform.claude.com/docs/en/build-with-claude/overview)）。

## 4. PC での確認（`speech.html`）

Web Speech API の最小ページ `speech.html` を作った（ビルド対象に追加。既存の `index.html` は変えていない）。開始・停止、言語の選択、`continuous` の切り替え（iPhone では既定で切る）、止まったら自動で再開、途中結果と確定結果の表示、イベントの時刻のログ、環境の表示（Web Speech API・standalone・`crossOriginIsolated`・WebGPU の有無）、ログのコピーができる。

PC（Windows 11、Chrome 152）での結果:

- 本物のマイクは試せなかった（自動操作の環境ではマイクが使えない）。Chrome の「偽のマイク」に WAV を流す方法は、認識側には音が届かず空の結果になった（Edge も同じ）。
- 代わりに、Chrome の新しい機能 `recognition.start(音声トラック)` で `sample_en.wav`（11秒、ケネディ演説）を直接流した。結果:

```
0.30s start(track) ok, audio 11.0s
1.46s first interim: and
3.34s FINAL: and so my fellow Americans
5.53s FINAL:  ask not
11.32s audio ended
15.42s FINAL:  what your country can do for you ask what you can do for your country
15.42s end
```

  音声の開始から約1.2秒で最初の途中結果、句ごとに確定結果が出た。最後の句は音声の終わりから約4秒後（停止を押した時点）に確定した。話し続けている間の確定の遅れは、停止を押さない普通の使い方では短いはずだが **未確認**。
- 認識の誤りは無かった（句読点は付かない）。

**iPhone での確認をお願いしたいこと**（`speech.html` を Safari のタブで開く）:

1. 「開始」でマイクの許可が出て、英語を話すと途中結果（灰色の斜体）と確定結果が出るか。
2. 黙ったときに止まるか、止まったら自動で再開するか（ログの `end` と `start`）。
3. `continuous` を入れた場合と切った場合で違いがあるか。
4. ホーム画面に追加して開いたときに動くか（動かない見込み。「環境」の standalone が「はい」になる）。
5. 「環境」の WebGPU と shader-f16 の表示（端末内認識をやるかの判断材料）。
6. 「ログをコピー」で結果を貼ってもらえると、次の判断に使える。

## 4.2 Moonshine Tiny Streaming の PC での確認（`moonshine/`）

`moonshine/index.html` に、3.1 の案 A のページを作った（2026-11-04）。

- `@moonshine-ai/moonshine-wasm@0.1.5` を `moonshine/vendor/` に置く（`?cdn=1` で jsDelivr から読むこともできる）。
- `moonshine/coi-serviceworker.js`（0.1.7）で COOP/COEP を付ける。`window.coi = { coepCredentialless: () => false }` を先に置く。Service Worker の範囲は `/moonshine/` の下だけ。
- モデルは `download.moonshine.ai` から読む（CORS は `*`。COEP の下でも読めた）。Tiny Streaming（英語）は7ファイル、合計 約 49MB。Cache API に保存されるので2回目からは通信なし。
- このビルドの共有メモリの上限は 4GB で、iPhone では確保できない恐れがある。iPhone では既定で上限 1GB のメモリを作って渡す（`?maxmem=1024 / 2048 / default` で変えられる）。
- タブが落ちても前回のログが残る（localStorage）。

PC（Windows 11、Chrome 152）での結果:

- 1回目の訪問は crossOriginIsolated が false → Service Worker が自動で再読み込み → true。
- 上限 1GB でも動いた。WASM 初期化 0.4s、モデル準備後の WASM メモリ 275MB（認識中 331MB）。
- `sample_en.wav`（11秒）を実時間で流すと、各行の確定は話し終わりから 0.06〜0.43s。処理時間は音声の長さの 0.13〜0.15 倍。
- 認識結果: "And so my fellow America," / "Ask not." / "What your country can do for you?" / "Ask what you can do for your country."（句読点あり。"Americans" が "America" になる誤りが1つ）
- マイクは自動操作の環境では使えないので試していない。
- ローカル確認では `python -m http.server` が Windows で `.mjs` を `text/plain` で返して読み込めないので、`serve.py` を使う（`npm run preview`）。

**GitHub Pages の設定の注意（2026-11-04 に判明）**: Pages の公開元が「GitHub Actions」ではなく「main ブランチのルート」（legacy）になっていて、Actions で作った `dist/` が後から走るブランチのデプロイで上書きされる。そのため `build.mjs` の `?v=` も公開サイトには入らない。`moonshine/` はどちらの方式でも動くように、`app.js` をページ側で `?v=現在時刻` を付けて読み、サンプルは `../sample_en.wav` を読む。

iPhone 1回目（2026-11-04 20:57）: crossOriginIsolated・WASM 初期化（上限 1GB）・モデル読み込み（WASM 191MB）までは動いた。サンプルは上の理由で 404。マイクは AudioContext running 48000Hz・AudioWorklet で開始できたが、文字が1つも出ず、エラーも出なかった。原因を調べるため、ライブラリの `MicTranscriber` をやめて自前の取り込みにし、音量・認識の回数・内部の結果を表示するようにした。

iPhone で確かめること: `https://tomosud.github.io/iphone_trans/moonshine/` を Safari のタブで開き、(1) 環境の crossOriginIsolated が true になるか（2回目以降の訪問も）、(2) 「モデルを読み込む」が最後まで行くか、(3) 「サンプル音声で試す」の結果と処理時間の倍率、(4) マイクで認識できるか、(5) 落ちた場合は再度開いたときに出る「前回のログ」。「ログをコピー」で貼ってもらう。

## 5. 未確認のことのまとめ

- iOS 26 / 27 の Safari で、Web Speech API がホーム画面の PWA で動くようになったか。iPhone での途中結果の出方、止まり方、重複の不具合。
- Moonshine（`moonshine-wasm`）、transformers.js、sherpa-onnx が iPhone の Safari で動くか、速さ。`coi-serviceworker` が iPhone で2回目以降も効くか。iPhone の WebGPU の shader-f16。
- クラウドの遅延の実測値。Deepgram のキーの権限・期限の細かい設定。Soniox のキーの権限の絞り方と日本語対応。OpenAI の文字起こしの言語数。
