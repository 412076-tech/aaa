# aaa

## 簡易記帳系統

此專案範例包含：

- `index.html`：前端畫面，放在專案根目錄，可獨立部署在靜態網站或其他主機。
- `styles.css`：前端樣式。
- `script.js`：前端邏輯，透過 `fetch()` 呼叫 Apps Script Web App API。
- `gas/Code.gs`：Apps Script 伺服端 API，負責讀寫 Google 試算表。
- `gas/appsscript.json`：Apps Script 專案設定。

## 使用方式

1. 開啟 Google Apps Script，建立新專案。
2. 將 `gas/Code.gs` 與 `gas/appsscript.json` 的內容貼到 Apps Script 專案內。
3. 在 `gas/Code.gs` 中，將 `SPREADSHEET_ID` 改成你要寫入的 Google 試算表 ID。
4. 部署為網路應用程式：
   - `執行 > 部署 > 新增部署`
   - 選擇 `類型：網路應用程式`
   - 設定 `誰可以存取：任何人` 或你的 Google 帳號可讀取。
5. 取得部署後的網址，並將 `script.js` 中的 `API_BASE_URL` 修改為該網址。
6. 將 `index.html`、`styles.css`、`script.js` 放到自己的靜態網站或 GitHub Pages。

## 重點

- 前端檔案不需要放到 Apps Script。
- Apps Script 只作為後端 API，前端透過 `fetch()` 呼叫。
- `google.script.run` 不適用於前端獨立部署的情況。

## 功能

- 前端頁面支援輸入時間、金額、項目與備註。
- 可新增自訂項目。
- 自動填入功能會透過 Apps Script 呼叫公開 API，產生測試資料。
- 提交後會將資料寫入 Google 試算表。
- 顯示本月分類統計圓餅圖。

## 進階說明

- `getCategories()` 會讀取試算表內已有分類，並與預設分類合併。
- `getMonthlyStats()` 會計算當月每個分類的總金額。
- `saveEntry()` 會收取前端送出的記帳資料並寫入試算表。
