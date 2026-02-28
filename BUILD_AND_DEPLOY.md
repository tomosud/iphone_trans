# Build and deploy

このリポジトリは静的サイトです。ソースはリポジトリ直下に置き、`npm run build` で `dist/` を生成して GitHub Pages へ出します。

## ローカル確認

1. Node.js 20 以上を入れる
2. ルートで `npm run build` を実行する
3. `dist/` が生成されることを確認する
4. `npm run preview` を実行する
5. `http://127.0.0.1:4173` を開く

## GitHub Pages 公開

1. このリポジトリを GitHub に push する
2. GitHub の `Settings > Pages` を開く
3. `Build and deployment` の `Source` を `GitHub Actions` に設定する
4. `main` ブランチへ push する
5. `Actions` タブで `Deploy static site to GitHub Pages` が成功することを確認する
6. 発行された Pages URL を iPhone で開く

## iPhone で新しい版を強制的に開く方法

GitHub Pages は反映まで少し時間がかかることがあり、さらに iPhone 側で HTML がキャッシュされることがあります。

1. まず `Actions` で deploy 完了を確認する
2. その後 1 から 10 分ほど待つ
3. URL の末尾に `?v=202602281650` のようなクエリを付けて開く
4. それでも古い場合はプライベートブラウズで開く
5. まだ古い場合は Safari のサイトデータを消す

例:

```text
https://tomosud.github.io/iphone_trans/?v=202602281650
```

このリポジトリの build は CSS と JS に自動で build version を付けるので、HTML さえ新しいものが開けばアセットは差し替わりやすくなります。

## Workflow の動き

1. `actions/checkout` でコードを取得する
2. `actions/setup-node` で Node.js をセットする
3. `npm run build` で `dist/` を作る
4. `dist/` を GitHub Pages の artifact として upload する
5. Pages へ deploy する

## 実機確認の流れ

1. iPhone で公開 URL を開く
2. 上の入力欄をタップする
3. キーボードのマイクで音声入力する
4. 下の表示欄へリアルタイム反映されることを確認する
5. ブラウザの翻訳機能を使う
6. 表示欄の翻訳と、翻訳後の追加入力追従を確認する
