# ADR 031: parquet-storageへの完全移行

## ステータス

Superseded by [ADR-051](./051-deprecate-parquet-storage.md)

## コンテキスト

Issue #179: sql.jsを完全に廃止し、parquet-storageに移行する必要がある。

### 背景
- sql.js (SQLite WASM)は659KB以上のWASMファイルをバンドルに含む
- parquet-storageは既に拡張機能で使用されており、実績がある
- サーバーサイドではNode.js環境でIndexedDBが使用できない

### 技術的課題
1. `ParquetStore`は`ParquetIndexedDBAdapter`をハードコードしている
2. Node.js環境にIndexedDBは存在しない
3. `parquet-store.ts`を変更するとWXTビルドエラーが発生する（原因不明）

## 決定

### アーキテクチャ
- **ブラウザ拡張機能**: 既存の`ParquetStore` + `ParquetIndexedDBAdapter`をそのまま使用
- **サーバーサイド**: `app/server`に専用の`ServerParquetAdapter` + `FileSystemAdapter`を作成

### 実装内容
1. `app/server/src/filesystem-adapter.ts` - ファイルシステムベースのストレージ
2. `app/server/src/server-parquet-adapter.ts` - サーバー用のParquetアダプター
3. sql.js関連ファイルの削除（sql-js-adapter.ts、sql-wasm.wasm）

### 利点
- ビルドサイズが1.05MBから393.75KBに削減（約62%削減）
- `parquet-storage`パッケージを変更せずに移行完了
- ブラウザとサーバーで同じスキーマ・ヘルパー関数を共有

### トレードオフ
- サーバーサイドに専用のアダプターが必要
- `ParquetStore`への依存性注入は将来の課題として残る

## 結果

- sql.js依存関係を完全に削除
- バンドルサイズの大幅削減
- ブラウザ拡張機能とサーバーの両方でparquet-storageを使用

## 関連

- ADR 007をSuperseded（このADRにより置換）
