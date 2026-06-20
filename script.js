const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbyRDKrQokl2qkdsRcXCvUY33vT2TNmAbqscG4GIzRoFsnvBUT8vz91jxoOIyXcHHpwW/exec';

// 测试连接
function testConnection() {
  console.log('[測試] 連接 API：', API_BASE_URL);
  fetch(API_BASE_URL)
    .then(r => r.json())
    .then(d => {
      console.log('[成功] API 連接正常：', d);
      setStatus('✓ 已連接到後端 Apps Script', 'success');
    })
    .catch(e => {
      console.error('[錯誤] API 連接失敗：', e);
      setStatus('✗ 無法連接到後端，請檢查網址：' + API_BASE_URL, 'error');
    });
}

const form = document.getElementById('entryForm');
const autoFillBtn = document.getElementById('autoFillBtn');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const refreshStatsBtn = document.getElementById('refreshStatsBtn');
const monthSelector = document.getElementById('monthSelector');
const statusBox = document.getElementById('status');
const categorySelect = document.getElementById('category');
const datetimeInput = document.getElementById('datetime');
const statsChart = document.getElementById('statsChart');
const statsLegend = document.getElementById('statsLegend');

let chartContext = statsChart.getContext('2d');

function setStatus(message, type = '') {
  statusBox.textContent = message;
  statusBox.className = 'status';
  if (type) {
    statusBox.classList.add(type);
  }
}

function setDatetimeNow() {
  const now = new Date();
  const formatted = now.toISOString().slice(0, 10);
  datetimeInput.value = formatted;
}

function addCategoryOption(category) {
  const normalized = category.trim();
  if (!normalized) return;
  const exists = Array.from(categorySelect.options).some((opt) => opt.value === normalized);
  if (exists) return;
  const option = document.createElement('option');
  option.value = normalized;
  option.textContent = normalized;
  categorySelect.appendChild(option);
}

function setCategories(categories) {
  const current = categorySelect.value;
  categorySelect.innerHTML = '<option value="" disabled>請選擇項目</option>';

  categories.forEach((item) => {
    const option = document.createElement('option');
    option.value = item;
    option.textContent = item;
    categorySelect.appendChild(option);
  });

  if (categories.includes(current)) {
    categorySelect.value = current;
  }
}

function populateForm(data) {
  if (!data) return;
  if (data.datetime) {
    datetimeInput.value = data.datetime;
  }
  document.getElementById('amount').value = data.amount || '';
  document.getElementById('category').value = data.category || '';
  document.getElementById('note').value = data.note || '';
}

function drawPieChart(stats, yearMonth) {
  const ctx = chartContext;
  ctx.clearRect(0, 0, statsChart.width, statsChart.height);
  statsLegend.innerHTML = '';

  // 格式化月份文字
  let monthText = '本月';
  if (yearMonth) {
    const [year, month] = yearMonth.split('-');
    monthText = `${year}年${month}月`;
  }

  if (!stats || stats.length === 0) {
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText(`${monthText}尚無資料`, statsChart.width / 2, statsChart.height / 2);
    return;
  }

  const total = stats.reduce((sum, item) => sum + item.amount, 0);
  let startAngle = -Math.PI / 2;
  const colors = ['#2f5cff', '#f97316', '#14b8a6', '#f43f5e', '#8b5cf6', '#facc15', '#0ea5e9', '#22c55e'];

  stats.forEach((item, index) => {
    const sliceAngle = (item.amount / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(statsChart.width / 2, statsChart.height / 2);
    ctx.arc(statsChart.width / 2, statsChart.height / 2, Math.min(statsChart.width, statsChart.height) / 2 - 16, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();

    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    legendItem.innerHTML = `<span class="legend-color" style="background:${ctx.fillStyle}"></span><strong>${item.category}</strong>：${item.amount} 元 (${Math.round((item.amount / total) * 100)}%)`;
    statsLegend.appendChild(legendItem);

    startAngle += sliceAngle;
  });
}

// 調用 Apps Script REST API
function apiRequest(action, method = 'GET', body = {}) {
  const url = `${API_BASE_URL}?action=${encodeURIComponent(action)}`;
  const options = { method, mode: 'cors' };

  if (method === 'POST') {
    options.headers = {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    };
    options.body = new URLSearchParams(body).toString();
  }

  return fetch(url, options)
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error || `API ${action} 呼叫失敗`);
      }
      return payload;
    });
}

function refreshStats() {
  const yearMonth = monthSelector && monthSelector.value ? monthSelector.value : '';
  console.log('[refreshStats] monthSelector:', monthSelector);
  console.log('[refreshStats] 選擇的月份值：', yearMonth);
  
  let url = `${API_BASE_URL}?action=getMonthlyStats`;
  if (yearMonth) {
    url += `&yearMonth=${encodeURIComponent(yearMonth)}`;
  }
  
  console.log('[refreshStats] 完整請求 URL：', url);
  
  fetch(url, { method: 'GET', mode: 'cors' })
    .then(async (response) => {
      console.log('[refreshStats] 回應狀態:', response.status);
      const payload = await response.json();
      console.log('[refreshStats] 回應數據:', payload);
      if (!response.ok || payload.error) {
        throw new Error(payload.error || 'API 呼叫失敗');
      }
      drawPieChart(payload, yearMonth);
    })
    .catch((error) => {
      console.error('[refreshStats] 錯誤:', error);
      setStatus('無法取得統計資料。', 'error');
    });
}

function handleAutoFill() {
  setStatus('正在呼叫 API，自動填入資料…');
  apiRequest('getAutoFillData')
    .then((data) => {
      if (data.category) {
        addCategoryOption(data.category);
      }
      populateForm(data);
      setStatus('已自動填入資料，請確認後送出。', 'success');
    })
    .catch((error) => {
      console.error(error);
      setStatus('API 自動填入失敗，請稍後再試。', 'error');
    });
}

function handleSubmit(event) {
  event.preventDefault();
  const entry = {
    datetime: document.getElementById('datetime').value,
    amount: Number(document.getElementById('amount').value),
    category: document.getElementById('category').value,
    note: document.getElementById('note').value.trim()
  };

  setStatus('送出中，資料儲存到 Google 試算表…');
  apiRequest('saveEntry', 'POST', entry)
    .then(() => {
      setStatus('儲存成功！已新增到 Google 試算表。', 'success');
      form.reset();
      setDatetimeNow();
      refreshStats();
    })
    .catch((error) => {
      console.error(error);
      setStatus('儲存失敗，請檢查設定或重試。', 'error');
    });
}

function handleAddCategory() {
  const category = window.prompt('請輸入新的項目名稱：', '零食');
  if (!category) {
    return;
  }
  addCategoryOption(category);
  categorySelect.value = category.trim();
}

function initialize() {
  console.log('[初始化] 應用程式啟動');
  setDatetimeNow();
  
  if (monthSelector) {
    const now = new Date();
    const currentYearMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    monthSelector.value = currentYearMonth;
    console.log('[初始化] 月份選擇器設定為：', currentYearMonth);
  } else {
    console.warn('[初始化] monthSelector 元素未找到!');
    return;
  }
  
  testConnection();  // 先測試連接
  
  setTimeout(() => {
    apiRequest('getCategories')
      .then((categories) => {
        setCategories(categories);
        refreshStats();
      })
      .catch((error) => {
        console.error(error);
        setStatus('無法讀取項目列表。', 'error');
        refreshStats();
      });
  }, 1000);
}

autoFillBtn.addEventListener('click', handleAutoFill);
addCategoryBtn.addEventListener('click', handleAddCategory);
refreshStatsBtn.addEventListener('click', refreshStats);

if (monthSelector) {
  monthSelector.addEventListener('change', () => {
    console.log('[事件] 月份選擇器改變，調用 refreshStats');
    refreshStats();
  });
} else {
  console.warn('[警告] monthSelector 元素未找到，無法綁定月份改變事件');
}

form.addEventListener('submit', handleSubmit);
window.addEventListener('DOMContentLoaded', initialize);
