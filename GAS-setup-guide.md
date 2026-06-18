# Google Apps Script 記帳系統部署指南

本指南說明如何將輸入資料透過後端 Google Apps Script 寫入 Google 試算表。

## 目標

- 前端頁面輸入金額、時間、分類與備註。
- 後端由 Google Apps Script 負責存取 Google 試算表。
- 所有資料寫入試算表，並可顯示本月統計圖表。

## 專案檔案說明

目前專案架構：

- `index.html`：前端表單與統計圖畫面。
- `styles.css`：前端樣式。
- `script.js`：前端 JavaScript，與 Apps Script 後端進行通訊。
- `gas/Code.gs`：Apps Script 伺服端邏輯，負責寫入 Google 試算表、讀取分類及統計資料。
- `gas/appsscript.json`：Apps Script 專案設定。

> 注意：`index.html`、`script.js`、`styles.css` 在本專案已移到專案根目錄，後端檔案仍放在 `gas/` 資料夾內。

---

## 一、建立 Google 試算表

1. 打開 `https://docs.google.com/spreadsheets/`。
2. 建立一個新的試算表。
3. 取出試算表 ID：網址中 `https://docs.google.com/spreadsheets/d/THIS_IS_ID/edit`。
4. 在試算表中建立工作表，預設名稱為 `Sheet1`。
5. 在第一列加入欄位標題：
   - A1：時間
   - B1：金額
   - C1：項目
   - D1：備註

---

## 二、建立 Google Apps Script 專案

1. 開啟 `:/https/script.google.com/`。
2. 點選「新專案」或「專案 > 新增專案」。
3. 在專案中建立如下兩個檔案：
   - `Code.gs`
   - `appsscript.json`
4. 如果要同時在 Apps Script 中使用前端檔案，請新增 `index.html`、`styles.css`、`script.js` 三個檔案。

> 也可直接把本專案內容貼到 Apps Script 新專案中。

---

## 三、貼上後端程式碼並設定試算表 ID

1. 開啟 `Code.gs`。
2. 將以下內容貼入：

```javascript
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';
const SHEET_NAME = 'Sheet1';
const DEFAULT_CATEGORIES = ['晚餐', '娛樂', '交通', '購物', '其他'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('記帳系統');
}

function getAutoFillData() {
  let category = DEFAULT_CATEGORIES[Math.floor(Math.random() * DEFAULT_CATEGORIES.length)];
  let note = 'API 自動填入範例';

  try {
    const response = UrlFetchApp.fetch('https://www.boredapi.com/api/activity', {muteHttpExceptions: true});
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      if (data.activity) {
        note = data.activity;
      }
      if (data.type) {
        category = data.type;
      }
    }
  } catch (err) {
    Logger.log('Auto-fill API 失敗：' + err);
  }

  const now = new Date();
  const datetimeLocal = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm");

  return {
    datetime: datetimeLocal,
    amount: Math.floor(Math.random() * 2400) + 100,
    category: category,
    note: note
  };
}

function getCategories() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const categories = new Set(DEFAULT_CATEGORIES);

  if (sheet) {
    const rowCount = sheet.getLastRow();
    if (rowCount >= 1) {
      const data = sheet.getRange(1, 3, rowCount, 1).getValues();
      data.forEach(([value]) => {
        if (value && value.toString() !== '項目') {
          categories.add(value.toString());
        }
      });
    }
  }

  return Array.from(categories).sort();
}

function getMonthlyStats() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) {
    return [];
  }

  const rows = sheet.getDataRange().getValues();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const totals = {};

  rows.forEach((row, index) => {
    if (index === 0 && row[0] === '時間') {
      return;
    }
    const dateValue = row[0];
    const amount = Number(row[1]);
    const category = row[2];

    if (!dateValue || isNaN(amount) || !category) {
      return;
    }

    const date = new Date(dateValue);
    if (date.getFullYear() !== currentYear || date.getMonth() !== currentMonth) {
      return;
    }

    totals[category] = (totals[category] || 0) + amount;
  });

  return Object.keys(totals).map((category) => ({
    category,
    amount: totals[category]
  })).sort((a, b) => b.amount - a.amount);
}

function saveEntry(entry) {
  if (!entry || !entry.amount || !entry.category) {
    throw new Error('請輸入金額與項目');
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(`找不到工作表：${SHEET_NAME}`);
  }

  const timestamp = entry.datetime ? new Date(entry.datetime) : new Date();
  if (isNaN(timestamp.getTime())) {
    throw new Error('時間格式不正確');
  }

  sheet.appendRow([
    timestamp,
    entry.amount,
    entry.category,
    entry.note || ''
  ]);

  return {status: 'success'};
}
```

3. 把 `const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';` 中的 `YOUR_SPREADSHEET_ID` 換成你的試算表 ID。

---

## 四、前端部署方式

前端檔案 `index.html`、`styles.css`、`script.js` 不需要放到 Apps Script。
你可以把它們放到自己的靜態網站、GitHub Pages、或其他主機上。

1. 修改 `script.js` 中的 `API_BASE_URL` 為 Apps Script Web App 的部署網址。
2. 將 `index.html`、`styles.css`、`script.js` 放到你自己的網站目錄中。
3. 確保網頁能夠存取這個 Apps Script 部署 URL，並使用 `fetch()` 呼叫後端 API。

> 前端請使用 `fetch()` 呼叫 Apps Script 的 `doGet()` / `doPost()` 端點。
> 不要使用 `google.script.run`，因為這個語法只適用於放在 Apps Script 專案內的 HTML。 

---

## 五、部署為網頁應用程式

1. 在 Apps Script 編輯器中點選 `部署 > 新增部署`。
2. 選擇 `類型：網路應用程式`。
3. 設定 `說明`（例如：記帳系統部署）。
4. 設定 `誰可以使用`：`任何人`（或依需求選擇僅限你自己）。
5. 按下 `部署`。
6. 複製部署後的網址，並在瀏覽器中開啟。

---

## 六、使用流程

1. 開啟部署後的網頁。
2. 輸入時間、金額、項目與備註。
3. 若要使用自動填入功能，按下 `自動填入`。
4. 若要新增自訂分類，按下 `新增項目`。
5. 按下 `送出記帳`，資料會寫入你的 Google 試算表。
6. 點選 `更新統計` 可以重新載入本月統計圖表。

---

## 七、後端負責的核心工作

- `saveEntry(entry)`：將輸入資料寫入 Google 試算表，欄位包含：時間、金額、項目、備註。
- `getCategories()`：讀取試算表內的分類，並與預設項目合併。
- `getMonthlyStats()`：計算本月各分類總額，供前端圓餅圖顯示。
- `getAutoFillData()`：呼叫公開 API 取得測試資料，示範後端呼叫 API 的流程。

---

## 八、測試與驗證

- 確認試算表第一列已有標題欄位。
- 確認 `SPREADSHEET_ID` 已正確貼入 `Code.gs`。
- 部署後開啟網頁，送出一次記帳，並在試算表中確認新資料是否出現。
- 確認本月統計圓餅圖可顯示資料。

---

## 九、常見問題

- `找不到工作表`：請確認工作表名稱與 `SHEET_NAME` 一致。
- `時間格式不正確`：請選擇 `datetime-local` 的時間欄位。
- `API 自動填入失敗`：這是示範 API，若外部 API 不穩定可改成穩定來源或移除。

---

## 十、補充說明

如果想改成純後端 REST API，前端只需改成 fetch 呼叫 Apps Script 的 `google.script.run` 或網路應用程式 URL API，後端仍可負責所有 Google 試算表寫入邏輯。
