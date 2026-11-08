# Flight Log（搭乗記録ログブック）

スマホで使える、自分専用のフライトログです。HTML / CSS / JavaScript だけで動きます。
データはブラウザ（localStorage）に保存され、サーバーやログインは不要です。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | 画面（一覧・入力・詳細・集計・データ管理） |
| `style.css` | 見た目（ログブック風。端末がダークモードなら夜間用の配色） |
| `app.js` | 保存・表示・集計・エクスポート/インポートの処理 |
| `sw.js` | オフライン（機内モード）対応の Service Worker |
| `manifest.webmanifest` | ホーム画面に追加するための設定 |
| `icons/` | アプリアイコン |
| `original/` | 比較用に保存した初期版（自由入力の航空会社欄・明朝/等幅フォント・文字アイコン）。オフライン機能だけ止めてあります |

## PC での動作確認

Service Worker は `file://` では動かないため、簡易サーバーを使って開きます。
macOS ならターミナルで次のコマンドを実行します（Ruby は標準で入っています）。

```sh
cd ~/Desktop/flightlog
ruby -run -e httpd . -p 8000
```

ブラウザで http://localhost:8000 を開きます。終了するときはターミナルで `Ctrl + C` を押します。

- **スマホ表示の確認**：Chrome で `⌥⌘I`（開発者ツール）→ 左上のスマホアイコン（`⇧⌘M`）
- **オフラインの確認**：開発者ツールの「Application」→「Service Workers」で `flightlog` が activated になっていることを確認 → 「Network」タブで「No throttling」を「Offline」に変更 → 再読み込みしても表示されれば OK
- **データの中身を見る**：「Application」→「Local Storage」→ `flightlog.flights.v1`

## スマホで使う（公開方法）

URL にアクセスして一度開けば、以降は機内モードでも起動できます。
データは公開先のサーバーではなく **各端末のブラウザに保存** されるので、他人に記録が見られることはありません（公開されるのはアプリのファイルだけです）。

### 方法 A：Netlify Drop（最も簡単・Git 不要）

1. https://app.netlify.com/drop を開き、無料アカウントを作成してログイン
2. `flightlog` フォルダを、Finder からブラウザの画面にドラッグ＆ドロップ
3. 数秒で `https://○○○.netlify.app` という URL が発行される
4. 「Site configuration」→「Change site name」で覚えやすい名前に変更できる
5. 更新するときは、サイトの「Deploys」タブに `flightlog` フォルダをもう一度ドロップ

### 方法 B：GitHub Pages（更新履歴を残したい場合）

1. GitHub に新しいリポジトリを作成（例：`flightlog`、Public）
2. リポジトリ画面の「Add file」→「Upload files」で、`flightlog` フォルダの **中身**（`index.html` など全部と `icons` フォルダ）をアップロードして「Commit changes」
3. 「Settings」→「Pages」→ Source を「Deploy from a branch」、Branch を `main` / `/(root)` にして Save
4. 1〜2分後に `https://ユーザー名.github.io/flightlog/` で公開される

### スマホのホーム画面に追加

- **iPhone（Safari）**：URL を開く → 共有ボタン → 「ホーム画面に追加」
- **Android（Chrome）**：URL を開く → 右上のメニュー → 「ホーム画面に追加」（または「アプリをインストール」）

追加後、一度ホーム画面から起動しておくと、機内モードでも確実に使えます。

## 注意点

- **データは端末・ブラウザごとに別々**です。iPhone の Safari とホーム画面アプリでは保存場所が分かれることがあるので、普段使う方を決めておきましょう。
- iPhone では、長期間開かないとブラウザのデータが消されることがあります。ホーム画面に追加して使い、ときどき「データ」タブから **JSON でエクスポート** してください（iCloud Drive などに保存しておくと安心です）。
- アプリを更新したのに変わらない場合は、一度開き直してください（裏で新しいファイルを取得し、次回の起動から反映されます）。ファイルの数や名前を変えたときは、`sw.js` の `CACHE_VERSION` の数字を上げてください。

## 初期版との比較（original フォルダ）

- 簡易サーバーを起動した状態で http://localhost:8000/original/ を開くと初期版、http://localhost:8000/ を開くと今の版が表示されます。
- 同じブラウザで開くと、記録データは **両方の版で共有** されます（どちらで追加・削除しても、もう一方にも反映されます）。比較用のデータで試すときは、先に「データ」タブからエクスポートしておくと安心です。
- Netlify や GitHub Pages に公開するときは、`original` フォルダを除いてアップロードしてください（入れたままでも動作に問題はありませんが、初期版も公開されます）。
