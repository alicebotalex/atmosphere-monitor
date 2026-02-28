const http = require('http');
const db = require('./database');

let pollInterval = null;
const sensorStatus = new Map();

// Fetch data from a Tasmota sensor
function fetchSensorData(ip) {
  return new Promise((resolve, reject) => {
    const url = `http://${ip}/cm?cmnd=Status%2010`;
    const timeout = 1500; // 1.5 seconds - fast local network timeout
    
    const req = http.get(url, { timeout }, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.StatusSNS && json.StatusSNS.PMS5003) {
            resolve({
              online: true,
              data: json.StatusSNS.PMS5003,
              timestamp: Date.now()
            });
          } else {
            resolve({ online: false, error: 'No PMS5003 data found' });
          }
        } catch (error) {
          resolve({ online: false, error: 'Invalid JSON response' });
        }
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ online: false, error: 'Request timeout' });
    });
    
    req.on('error', (error) => {
      resolve({ online: false, error: error.message });
    });
  });
}

// Poll all sensors in parallel
async function pollSensors() {
  const sensors = db.getSensors();
  
  // Fetch all sensors simultaneously
  const fetchPromises = sensors.map(sensor => 
    fetchSensorData(sensor.ip).then(result => ({
      id: sensor.id,
      name: sensor.name,
      ip: sensor.ip,
      ...result
    }))
  );
  
  const results = await Promise.all(fetchPromises);
  
  // Update status map
  results.forEach(result => {
    sensorStatus.set(result.id, {
      online: result.online,
      data: result.data,
      timestamp: result.timestamp,
      error: result.error
    });
  });
  
  return results;
}

// Start polling with callback
function startPolling(interval, callback) {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
  
  // Poll immediately on start
  pollSensors().then(callback).catch(console.error);
  
  // Then poll on interval
  pollInterval = setInterval(async () => {
    try {
      const data = await pollSensors();
      callback(data);
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, interval);
  
  console.log(`Polling started with ${interval}ms interval`);
}

// Stop polling
function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('Polling stopped');
  }
}

module.exports = {
  pollSensors,
  startPolling,
  stopPolling
};
