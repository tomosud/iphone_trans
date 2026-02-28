# iPhone voice input + browser translate prototype

GitHub Pages で公開して、次の成立性を確認するための最小プロトタイプです。

https://tomosud.github.io/iphone_trans/

- 上の入力欄に入れた文字が、下の表示欄へリアルタイム反映されるか
- iPhone の音声入力で `textarea` に入力できるか
- ブラウザ翻訳をかけたとき、下の表示欄が翻訳対象になるか
- 翻訳後に追加入力した内容まで自動で翻訳され続けるか

## なぜこの構成か

ブラウザ翻訳はフォーム入力値より通常テキストノードを扱う方が期待しやすいため、入力欄とは別に表示欄を置いています。

これは Chromium の翻訳 API/仕様まわりの説明からの推定です。Chrome 系ではページ翻訳とは別に、動的・ユーザー生成テキスト向けの Translator API が用意されており、リアルタイム更新テキストは built-in のページ翻訳だけでは追従が不安定な可能性があります。

参考:

- GitHub Pages custom workflow: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Chrome built-in AI Translator API overview: https://developer.chrome.com/docs/ai/translator-api
- Chrome translation capabilities explainer: https://github.com/explainers-by-googlers/translation-api

## Build

このリポジトリは `npm run build` で `dist/` を生成します。

```bash
npm run build
```

プレビュー:

```bash
npm run preview
```

詳細手順は [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) にまとめています。

`build` では `dist/index.html` 内の CSS と JS に build version を自動付与します。iPhone で古い版が残る場合は、ページ URL 自体にも `?v=...` を付けて開いてください。

## 現在の表示方針

- 入力欄は iPhone でも 1 行に収まる `input[type="text"]`
- 表示欄は全文を毎回描画せず、最近のチャンクだけを表示
- 音声入力の更新はそのまま即 DOM 反映せず、短い間隔でまとめて反映
- 一定文字数または短い停止でチャンクを確定し、翻訳対象を肥大化させすぎない

## 公開手順

1. GitHub にこのリポジトリを push する
2. GitHub の `Settings > Pages` を開く
3. `Build and deployment` の `Source` を `GitHub Actions` にする
4. `main` へ push すると `npm run build` を含む `Deploy static site to GitHub Pages` が走る
5. 公開 URL を iPhone で開く

## iPhone での検証手順

1. 上の入力欄をタップする
2. iPhone キーボードのマイクで音声入力する
3. 下の表示欄が即時更新されることを確認する
4. ブラウザのページ翻訳を実行する
5. 下の表示欄が翻訳されるか確認する
6. そのまま追加入力し、翻訳済み表示が追従するか確認する

## 予想される結果

- 音声入力そのものは、通常の `textarea` を使っているため iPhone 側の標準機能で成立する可能性が高い
- 入力内容のリアルタイム反映はこのプロトタイプで成立する
- ただし、ブラウザ翻訳が動的に更新されたテキストまで継続翻訳するかは不安定な可能性が高い

この最後の点を、GitHub Pages 上で実機確認するのが今回の目的です。
