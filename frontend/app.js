// State
let sensors = [];
let preferences = { cardOrder: [], metricToggles: {}, chartTimeWindow: 60 };
let charts = {};
let chartData = {};
let ws = null;

// Time window control constants
const TIME_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 240]; // minutes

function formatTimeValue(minutes) {
  if (minutes < 60) return `${minutes}m`;
  return `${minutes / 60}h`;
}

function getSliderIndexForMinutes(minutes) {
  const idx = TIME_STEPS.indexOf(minutes);
  return idx >= 0 ? idx : 5; // default to 30min if not found
}

function formatChartTime(timestamp) {
  const date = new Date(timestamp);
  const timeWindow = preferences.chartTimeWindow || 60;
  
  // Show seconds only for very short time windows (5 min or less)
  if (timeWindow <= 5) {
    return date.toLocaleTimeString();
  } else {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}

// Smoothing function - simple moving average
function smoothData(data, windowSize = 6) {
  if (data.length < windowSize) return data;
  
  const smoothed = [];
  for (let i = 0; i < data.length; i++) {
    if (i < windowSize - 1) {
      // Not enough data yet, use what we have
      const slice = data.slice(0, i + 1);
      smoothed.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    } else {
      // Full window available
      const slice = data.slice(i - windowSize + 1, i + 1);
      smoothed.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    }
  }
  return smoothed;
}

// WebSocket connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected, reconnecting...');
    setTimeout(connectWebSocket, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function handleWebSocketMessage(message) {
  switch (message.type) {
    case 'init':
      sensors = message.sensors;
      preferences = message.preferences;
      // Sync header slider with loaded preferences
      const timeSlider = document.getElementById('timeSlider');
      const timeValueDisplay = document.getElementById('timeValue');
      if (timeSlider && timeValueDisplay) {
        const minutes = preferences.chartTimeWindow || 60;
        timeSlider.value = getSliderIndexForMinutes(minutes);
        timeValueDisplay.textContent = formatTimeValue(minutes);
      }
      renderDashboard();
      break;
    
    case 'sensor_data':
      updateSensorData(message.data);
      break;
    
    case 'sensor_added':
      sensors.push(message.sensor);
      renderDashboard();
      break;
    
    case 'sensor_updated':
      const idx = sensors.findIndex(s => s.id === message.sensor.id);
      if (idx !== -1) {
        sensors[idx] = message.sensor;
        renderDashboard();
      }
      break;
    
    case 'sensor_deleted':
      sensors = sensors.filter(s => s.id !== message.id);
      delete charts[message.id];
      delete chartData[message.id];
      renderDashboard();
      break;
    
    case 'preferences_updated':
      preferences = { ...preferences, ...message.preferences };
      break;
  }
}

function updateSensorData(sensorDataArray) {
  sensorDataArray.forEach(sensorData => {
    const { id, online, data, timestamp, error } = sensorData;
    
    // Update status indicator
    const statusEl = document.querySelector(`[data-sensor-id="${id}"] .sensor-status`);
    if (statusEl) {
      statusEl.classList.toggle('online', online);
    }
    
    if (!online) {
      // Show offline message
      const card = document.querySelector(`[data-sensor-id="${id}"]`);
      if (card) {
        const chartContainer = card.querySelector('.chart-container');
        if (chartContainer && !chartContainer.querySelector('.offline-message')) {
          chartContainer.innerHTML = `<div class="offline-message">Sensor offline: ${error || 'Unknown error'}</div>`;
        }
      }
      return;
    }
    
    // Update chart
    updateChart(id, data, timestamp);
  });
}

function updateChart(sensorId, data, timestamp) {
  if (!chartData[sensorId]) {
    chartData[sensorId] = {
      labels: [],
      timestamps: [],
      PM1: [],
      'PM2.5': [],
      PM10: [],
      'PB0.3': [],
      'PB0.5': [],
      'PB1': [],
      'PB2.5': [],
      'PB5': [],
      'PB10': []
    };
  }
  
  const chartDataset = chartData[sensorId];
  
  // Add new data point
  const time = formatChartTime(timestamp);
  chartDataset.labels.push(time);
  chartDataset.timestamps.push(timestamp);
  chartDataset.PM1.push(data.PM1 || 0);
  chartDataset['PM2.5'].push(data['PM2.5'] || 0);
  chartDataset.PM10.push(data.PM10 || 0);
  chartDataset['PB0.3'].push(data['PB0.3'] || 0);
  chartDataset['PB0.5'].push(data['PB0.5'] || 0);
  chartDataset.PB1.push(data.PB1 || 0);
  chartDataset['PB2.5'].push(data['PB2.5'] || 0);
  chartDataset.PB5.push(data.PB5 || 0);
  chartDataset.PB10.push(data.PB10 || 0);
  
  // Apply time window filter
  const timeWindowMs = (preferences.chartTimeWindow || 60) * 60 * 1000;
  const now = Date.now();
  const cutoffTime = now - timeWindowMs;
  
  // Find first index within time window
  let startIndex = 0;
  for (let i = 0; i < chartDataset.timestamps.length; i++) {
    if (new Date(chartDataset.timestamps[i]).getTime() >= cutoffTime) {
      startIndex = i;
      break;
    }
  }
  
  // Trim old data
  if (startIndex > 0) {
    chartDataset.labels = chartDataset.labels.slice(startIndex);
    chartDataset.timestamps = chartDataset.timestamps.slice(startIndex);
    Object.keys(chartDataset).forEach(key => {
      if (key !== 'labels' && key !== 'timestamps') {
        chartDataset[key] = chartDataset[key].slice(startIndex);
      }
    });
  }
  
  // Update chart with smoothed data
  const chart = charts[sensorId];
  if (chart) {
    chart.data.labels = chartDataset.labels;
    chart.data.datasets.forEach(dataset => {
      const rawData = chartDataset[dataset.label];
      dataset.data = smoothData(rawData, 6); // ~30 seconds at 5sec polling
    });
    chart.update(); // Animate transitions
  }
}

function createChart(sensorId, canvasId) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  
  const toggles = preferences.metricToggles[sensorId] || {};
  
  const datasets = [
    { label: 'PM1', data: [], borderColor: '#4a9eff', hidden: toggles.PM1 === false },
    { label: 'PM2.5', data: [], borderColor: '#ff9800', hidden: toggles['PM2.5'] === false },
    { label: 'PM10', data: [], borderColor: '#f44336', hidden: toggles.PM10 === false },
    { label: 'PB0.3', data: [], borderColor: '#9c27b0', hidden: toggles['PB0.3'] !== true },
    { label: 'PB0.5', data: [], borderColor: '#e91e63', hidden: toggles['PB0.5'] !== true },
    { label: 'PB1', data: [], borderColor: '#3f51b5', hidden: toggles.PB1 !== true },
    { label: 'PB2.5', data: [], borderColor: '#00bcd4', hidden: toggles['PB2.5'] !== true },
    { label: 'PB5', data: [], borderColor: '#009688', hidden: toggles.PB5 !== true },
    { label: 'PB10', data: [], borderColor: '#8bc34a', hidden: toggles.PB10 !== true }
  ].map(ds => ({
    ...ds,
    borderWidth: 2,
    tension: 0.4,
    pointRadius: 0,
    fill: false
  }));
  
  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 300 // Smooth 300ms transitions
      },
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#444' },
          ticks: { color: '#b0b0b0' }
        },
        x: {
          grid: { color: '#444' },
          ticks: { color: '#b0b0b0', maxTicksLimit: 10 }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      }
    }
  });
  
  return chart;
}

function renderDashboard() {
  const dashboard = document.getElementById('dashboard');
  
  if (sensors.length === 0) {
    dashboard.innerHTML = `
      <div class="empty-state">
        <p>No sensors configured</p>
        <button id="addFirstSensor" class="btn btn-primary">Add Your First Sensor</button>
      </div>
    `;
    document.getElementById('addFirstSensor').addEventListener('click', openSettings);
    return;
  }
  
  // Sort sensors by cardOrder preference
  const orderedSensors = [...sensors].sort((a, b) => {
    const orderA = preferences.cardOrder.indexOf(a.id);
    const orderB = preferences.cardOrder.indexOf(b.id);
    if (orderA === -1 && orderB === -1) return 0;
    if (orderA === -1) return 1;
    if (orderB === -1) return -1;
    return orderA - orderB;
  });
  
  dashboard.innerHTML = orderedSensors.map(sensor => createSensorCard(sensor)).join('');
  
  // Create charts
  orderedSensors.forEach(sensor => {
    const chart = createChart(sensor.id, `chart-${sensor.id}`);
    if (chart) charts[sensor.id] = chart;
    
    // Add metric toggle listeners
    const toggles = document.querySelectorAll(`[data-sensor-id="${sensor.id}"] .metric-toggle input`);
    toggles.forEach(toggle => {
      toggle.addEventListener('change', () => handleMetricToggle(sensor.id, toggle));
    });
  });
  
  // Enable drag-and-drop
  new Sortable(dashboard, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: handleCardReorder
  });
}

function createSensorCard(sensor) {
  const toggles = preferences.metricToggles[sensor.id] || {};
  
  return `
    <div class="sensor-card" data-sensor-id="${sensor.id}">
      <div class="sensor-header">
        <div class="sensor-name">${sensor.name}</div>
        <span class="sensor-status"></span>
      </div>
      
      <div class="chart-container">
        <canvas id="chart-${sensor.id}"></canvas>
      </div>
      
      <div class="metric-toggles">
        ${createMetricToggle('PM1', toggles.PM1 !== false)}
        ${createMetricToggle('PM2.5', toggles['PM2.5'] !== false)}
        ${createMetricToggle('PM10', toggles.PM10 !== false)}
        ${createMetricToggle('PB0.3', toggles['PB0.3'] === true)}
        ${createMetricToggle('PB0.5', toggles['PB0.5'] === true)}
        ${createMetricToggle('PB1', toggles.PB1 === true)}
        ${createMetricToggle('PB2.5', toggles['PB2.5'] === true)}
        ${createMetricToggle('PB5', toggles.PB5 === true)}
        ${createMetricToggle('PB10', toggles.PB10 === true)}
      </div>
    </div>
  `;
}

function createMetricToggle(metric, checked) {
  return `
    <label class="metric-toggle">
      <input type="checkbox" data-metric="${metric}" ${checked ? 'checked' : ''}>
      <span>${metric}</span>
    </label>
  `;
}

function handleMetricToggle(sensorId, toggle) {
  const metric = toggle.dataset.metric;
  const isChecked = toggle.checked;
  
  if (!preferences.metricToggles[sensorId]) {
    preferences.metricToggles[sensorId] = {};
  }
  preferences.metricToggles[sensorId][metric] = isChecked;
  
  // Update chart visibility
  const chart = charts[sensorId];
  if (chart) {
    const dataset = chart.data.datasets.find(ds => ds.label === metric);
    if (dataset) {
      dataset.hidden = !isChecked;
      chart.update();
    }
  }
  
  // Save preferences
  savePreferences();
}

function handleCardReorder(evt) {
  const newOrder = Array.from(evt.to.children).map(card => {
    return parseInt(card.dataset.sensorId);
  });
  
  preferences.cardOrder = newOrder;
  savePreferences();
}

async function savePreferences() {
  try {
    await fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences)
    });
  } catch (error) {
    console.error('Failed to save preferences:', error);
  }
}

// Settings modal
const modal = document.getElementById('settingsModal');
const settingsBtn = document.getElementById('settingsBtn');
const closeBtn = modal.querySelector('.close');

function openSettings() {
  renderSensorList();
  modal.classList.add('active');
}

settingsBtn.addEventListener('click', openSettings);
closeBtn.addEventListener('click', () => modal.classList.remove('active'));

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.remove('active');
  }
});

function renderSensorList() {
  const sensorList = document.getElementById('sensorList');
  
  if (sensors.length === 0) {
    sensorList.innerHTML = '<p style="color: var(--text-secondary);">No sensors added yet</p>';
    return;
  }
  
  sensorList.innerHTML = sensors.map(sensor => `
    <div class="sensor-item">
      <div class="sensor-info">
        <strong>${sensor.name}</strong>
        <small>${sensor.ip}</small>
      </div>
      <button class="btn btn-danger" onclick="deleteSensor(${sensor.id})">Delete</button>
    </div>
  `).join('');
  
  // Update time window select
  const timeWindowSelect = document.getElementById('chartTimeWindow');
  if (timeWindowSelect) {
    timeWindowSelect.value = preferences.chartTimeWindow || 60;
  }
}

document.getElementById('addSensorBtn').addEventListener('click', async () => {
  const name = document.getElementById('sensorName').value.trim();
  const ip = document.getElementById('sensorIp').value.trim();
  
  if (!name || !ip) {
    alert('Please enter both name and IP address');
    return;
  }
  
  try {
    const response = await fetch('/api/sensors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ip })
    });
    
    if (response.ok) {
      document.getElementById('sensorName').value = '';
      document.getElementById('sensorIp').value = '';
      renderSensorList();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to add sensor');
    }
  } catch (error) {
    alert('Failed to add sensor: ' + error.message);
  }
});

async function deleteSensor(id) {
  if (!confirm('Are you sure you want to delete this sensor?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/sensors/${id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      renderSensorList();
    } else {
      alert('Failed to delete sensor');
    }
  } catch (error) {
    alert('Failed to delete sensor: ' + error.message);
  }
}

// Time window control
function refreshChartsTimeWindow() {
  Object.keys(chartData).forEach(sensorId => {
    const dataset = chartData[sensorId];
    const chart = charts[sensorId];
    if (chart && dataset) {
      const timeWindowMs = preferences.chartTimeWindow * 60 * 1000;
      const now = Date.now();
      const cutoffTime = now - timeWindowMs;
      
      let startIndex = 0;
      for (let i = 0; i < dataset.timestamps.length; i++) {
        if (new Date(dataset.timestamps[i]).getTime() >= cutoffTime) {
          startIndex = i;
          break;
        }
      }
      
      // Regenerate labels with current time format (seconds shown only for short windows)
      const filteredTimestamps = dataset.timestamps.slice(startIndex);
      const filteredLabels = filteredTimestamps.map(ts => formatChartTime(ts));
      
      // Also update stored labels for consistency
      dataset.labels = dataset.timestamps.map(ts => formatChartTime(ts));
      
      chart.data.labels = filteredLabels;
      chart.data.datasets.forEach(ds => {
        const rawData = dataset[ds.label].slice(startIndex);
        ds.data = smoothData(rawData, 6);
      });
      chart.update();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Header slider
  const timeSlider = document.getElementById('timeSlider');
  const timeValueDisplay = document.getElementById('timeValue');
  
  if (timeSlider && timeValueDisplay) {
    // Initialize slider position from preferences
    const currentMinutes = preferences.chartTimeWindow || 60;
    timeSlider.value = getSliderIndexForMinutes(currentMinutes);
    timeValueDisplay.textContent = formatTimeValue(currentMinutes);
    
    timeSlider.addEventListener('input', (e) => {
      const minutes = TIME_STEPS[parseInt(e.target.value)];
      timeValueDisplay.textContent = formatTimeValue(minutes);
      preferences.chartTimeWindow = minutes;
      
      // Sync dropdown in settings
      const timeWindowSelect = document.getElementById('chartTimeWindow');
      if (timeWindowSelect) {
        timeWindowSelect.value = minutes;
      }
      
      savePreferences();
      refreshChartsTimeWindow();
    });
  }
  
  // Settings dropdown (backup control)
  const timeWindowSelect = document.getElementById('chartTimeWindow');
  if (timeWindowSelect) {
    timeWindowSelect.addEventListener('change', (e) => {
      preferences.chartTimeWindow = parseInt(e.target.value);
      
      // Sync header slider
      if (timeSlider && timeValueDisplay) {
        timeSlider.value = getSliderIndexForMinutes(preferences.chartTimeWindow);
        timeValueDisplay.textContent = formatTimeValue(preferences.chartTimeWindow);
      }
      
      savePreferences();
      refreshChartsTimeWindow();
    });
  }
});

// Network Scan
let scanResults = [];

document.getElementById('scanNetworkBtn').addEventListener('click', async () => {
  const scanBtn = document.getElementById('scanNetworkBtn');
  const progressDiv = document.getElementById('scanProgress');
  const resultsDiv = document.getElementById('scanResults');
  const statusText = progressDiv.querySelector('.scan-status');
  const fillBar = progressDiv.querySelector('.scan-fill');
  
  // Reset UI
  scanBtn.disabled = true;
  scanBtn.textContent = '🔍 Scanning...';
  progressDiv.style.display = 'block';
  resultsDiv.style.display = 'none';
  fillBar.style.width = '0%';
  scanResults = [];
  
  try {
    const response = await fetch('/api/scan', {
      method: 'POST'
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');
      
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        
        const data = JSON.parse(line.slice(6));
        
        if (data.type === 'progress') {
          const percent = Math.round((data.scanned / data.total) * 100);
          fillBar.style.width = percent + '%';
          statusText.textContent = `Scanning ${data.subnet || 'network'}... ${data.scanned}/${data.total}`;
        } else if (data.type === 'complete') {
          scanResults = data.devices;
          displayScanResults(scanResults);
          progressDiv.style.display = 'none';
        } else if (data.type === 'error') {
          alert('Scan failed: ' + data.error);
          progressDiv.style.display = 'none';
        }
      }
    }
  } catch (error) {
    alert('Scan failed: ' + error.message);
    progressDiv.style.display = 'none';
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = '🔍 Scan Network';
  }
});

function displayScanResults(devices) {
  const resultsDiv = document.getElementById('scanResults');
  const resultsList = document.getElementById('scanResultsList');
  
  if (devices.length === 0) {
    resultsList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No Tasmota PMS5003 devices found</p>';
    resultsDiv.style.display = 'block';
    return;
  }
  
  resultsList.innerHTML = devices.map((device, index) => {
    const pmData = device.data;
    const dataStr = pmData ? `PM2.5: ${pmData['PM2.5'] || 0} µg/m³` : 'No data';
    
    return `
      <div class="scan-result-item" data-index="${index}">
        <div class="scan-result-info">
          <div class="scan-result-ip">${device.ip}</div>
          <div class="scan-result-data">${dataStr}</div>
        </div>
        <div class="scan-result-actions">
          ${device.alreadyAdded 
            ? '<span class="scan-result-status">Already added</span>'
            : `
              <input type="text" placeholder="Sensor name" value="Sensor at ${device.ip}">
              <button class="btn btn-primary" onclick="addScannedSensor(${index})">Add</button>
            `
          }
        </div>
      </div>
    `;
  }).join('');
  
  resultsDiv.style.display = 'block';
}

async function addScannedSensor(index) {
  const device = scanResults[index];
  const itemEl = document.querySelector(`.scan-result-item[data-index="${index}"]`);
  const nameInput = itemEl.querySelector('input');
  const name = nameInput.value.trim();
  
  if (!name) {
    alert('Please enter a sensor name');
    return;
  }
  
  try {
    const response = await fetch('/api/sensors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ip: device.ip })
    });
    
    if (response.ok) {
      // Update UI to show "Already added"
      device.alreadyAdded = true;
      itemEl.querySelector('.scan-result-actions').innerHTML = '<span class="scan-result-status">Already added</span>';
      renderSensorList();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to add sensor');
    }
  } catch (error) {
    alert('Failed to add sensor: ' + error.message);
  }
}

// Initialize
connectWebSocket();
