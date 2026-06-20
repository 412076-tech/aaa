const SPREADSHEET_ID = '1HO0ViY2dOXIi9xJAo6VPnFUpmC8dNuwHcyKRGCU4VDk';
const SHEET_NAME = 'Sheet1';
const DEFAULT_CATEGORIES = ['晚餐', '娛樂', '交通', '購物', '其他'];

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || '';
  const yearMonth = e.parameter && e.parameter.yearMonth;
  
  Logger.log('=== doGet 請求 ===');
  Logger.log('action: ' + action);
  Logger.log('yearMonth: ' + yearMonth);
  
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
        Logger.log('調用 getMonthlyStats，yearMonth: ' + yearMonth);
        const result = getMonthlyStats(yearMonth);
        Logger.log('getMonthlyStats 結果: ' + JSON.stringify(result));
        return createJsonResponse(result);
      default:
        return createJsonResponse({error: `未知的 action：${action}`});
    }
  } catch (err) {
    Logger.log('錯誤: ' + err.message);
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
  const dateOnly = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");

  return {
    datetime: dateOnly,
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

function getMonthlyStats(yearMonth) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) {
    return [];
  }

  // 確定目標年月
  let targetYear = '';
  let targetMonth = '';
  
  if (yearMonth && /^\d{4}-\d{2}$/.test(yearMonth)) {
    const parts = yearMonth.split('-');
    targetYear = parts[0];
    targetMonth = parts[1];
  } else {
    const now = new Date();
    targetYear = String(now.getFullYear());
    targetMonth = String(now.getMonth() + 1).padStart(2, '0');
  }

  Logger.log('=== getMonthlyStats ===');
  Logger.log('傳入的 yearMonth: ' + yearMonth);
  Logger.log('目標年月: ' + targetYear + '-' + targetMonth);

  const rows = sheet.getDataRange().getValues();
  const totals = {};
  let matchCount = 0;

  rows.forEach((row, index) => {
    // 跳過標題行
    if (index === 0) {
      return;
    }
    
    const dateValue = row[0];
    const amount = Number(row[1]);
    const category = row[2];

    // 驗證必要數據
    if (!dateValue || isNaN(amount) || !category) {
      return;
    }

    // 提取年月
    let rowYear = '';
    let rowMonth = '';

    if (dateValue instanceof Date) {
      // Date 物件
      rowYear = String(dateValue.getFullYear());
      rowMonth = String(dateValue.getMonth() + 1).padStart(2, '0');
      Logger.log('Row ' + index + ' (Date 物件): ' + dateValue.toDateString() + ' -> ' + rowYear + '-' + rowMonth);
    } else {
      // 字符串處理
      const dateStr = String(dateValue).trim();
      const dateMatch = dateStr.match(/^(\d{4})-?\/?\s*(\d{1,2})/);
      
      if (dateMatch) {
        rowYear = dateMatch[1];
        rowMonth = String(parseInt(dateMatch[2])).padStart(2, '0');
        Logger.log('Row ' + index + ' (字符串): ' + dateStr + ' -> ' + rowYear + '-' + rowMonth);
      } else {
        Logger.log('Row ' + index + ' 日期格式無法識別: ' + dateStr);
        return;
      }
    }

    // 比較年月
    if (rowYear === targetYear && rowMonth === targetMonth) {
      totals[category] = (totals[category] || 0) + amount;
      matchCount++;
      Logger.log('  ✓ 匹配！ ' + category + ' += ' + amount);
    }
  });

  Logger.log('總共匹配 ' + matchCount + ' 行');
  const result = Object.keys(totals).map((category) => ({
    category,
    amount: totals[category]
  })).sort((a, b) => b.amount - a.amount);
  Logger.log('結果: ' + JSON.stringify(result));
  
  return result;
}

function saveEntry(entry) {
  if (!entry || !entry.amount || !entry.category) {
    throw new Error('請輸入金額與項目');
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(`找不到工作表：${SHEET_NAME}`);
  }

  let dateToSave = null;
  
  if (entry.datetime) {
    // 處理日期字符串 (YYYY-MM-DD 格式)
    const timestamp = new Date(entry.datetime);
    if (isNaN(timestamp.getTime())) {
      throw new Error('時間格式不正確');
    }
    dateToSave = timestamp;
  } else {
    dateToSave = new Date();
  }

  Logger.log('儲存記錄: 日期=' + dateToSave.toDateString() + ', 金額=' + entry.amount + ', 項目=' + entry.category);

  sheet.appendRow([
    dateToSave,
    entry.amount,
    entry.category,
    entry.note || ''
  ]);

  return {status: 'success'};
}
