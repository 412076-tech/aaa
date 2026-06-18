const SPREADSHEET_ID = '1HO0ViY2dOXIi9xJAo6VPnFUpmC8dNuwHcyKRGCU4VDk';
const SHEET_NAME = 'Sheet1';
const DEFAULT_CATEGORIES = ['晚餐', '娛樂', '交通', '購物', '其他'];

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || '';
  
  // 如果没有 action，返回测试信息（用于诊断）
  if (!action) {
    return createJsonResponse({
      message: 'Google Apps Script 記帳系統 API',
      status: 'running',
      spreadsheet_id: SPREADSHEET_ID,
      sheet_name: SHEET_NAME
    });
  }
  
  try {
    switch (action) {
      case 'getAutoFillData':
        return createJsonResponse(getAutoFillData());
      case 'getCategories':
        return createJsonResponse(getCategories());
      case 'getMonthlyStats':
        return createJsonResponse(getMonthlyStats());
      default:
        return createJsonResponse({error: `未知的 action：${action}`});
    }
  } catch (err) {
    return createJsonResponse({error: err.message || '伺服器錯誤'});
  }
}

function doPost(e) {
  const action = (e.parameter && e.parameter.action) || '';

  try {
    if (action === 'saveEntry') {
      const entry = {
        datetime: e.parameter.datetime,
        amount: Number(e.parameter.amount),
        category: e.parameter.category,
        note: e.parameter.note
      };
      return createJsonResponse(saveEntry(entry));
    }

    return createJsonResponse({error: `未知的 action：${action}`});
  } catch (err) {
    return createJsonResponse({error: err.message || '伺服器錯誤'});
  }
}

function createJsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
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
