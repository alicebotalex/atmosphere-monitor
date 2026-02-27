const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const db = require('./database');
const { pollSensors, startPolling, stopPolling } = require('./poller');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const POLL_INTERVAL = process.env.POLL_INTERVAL || 5000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// WebSocket connections
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');
  clients.add(ws);
  
  // Send current sensors and preferences on connect
  const sensors = db.getSensors();
  const preferences = db.getPreferences();
  ws.send(JSON.stringify({ type: 'init', sensors, preferences }));
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// REST API Routes

// Get all sensors
app.get('/api/sensors', (req, res) => {
  try {
    const sensors = db.getSensors();
    res.json(sensors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new sensor
app.post('/api/sensors', (req, res) => {
  try {
    const { name, ip } = req.body;
    if (!name || !ip) {
      return res.status(400).json({ error: 'Name and IP are required' });
    }
    
    const sensors = db.getSensors();
    if (sensors.length >= 16) {
      return res.status(400).json({ error: 'Maximum 16 sensors allowed' });
    }
    
    const sensor = db.addSensor(name, ip);
    broadcast({ type: 'sensor_added', sensor });
    res.json(sensor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update sensor
app.put('/api/sensors/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, ip } = req.body;
    
    db.updateSensor(id, name, ip);
    const sensor = db.getSensors().find(s => s.id === parseInt(id));
    broadcast({ type: 'sensor_updated', sensor });
    res.json(sensor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete sensor
app.delete('/api/sensors/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.deleteSensor(id);
    broadcast({ type: 'sensor_deleted', id: parseInt(id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get preferences
app.get('/api/preferences', (req, res) => {
  try {
    const preferences = db.getPreferences();
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update preferences
app.put('/api/preferences', (req, res) => {
  try {
    db.updatePreferences(req.body);
    broadcast({ type: 'preferences_updated', preferences: req.body });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start polling and server
startPolling(POLL_INTERVAL, (sensorData) => {
  broadcast({ type: 'sensor_data', data: sensorData });
});

server.listen(PORT, () => {
  console.log(`Atmosphere Monitor running on http://localhost:${PORT}`);
  console.log(`Polling sensors every ${POLL_INTERVAL}ms`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  stopPolling();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  stopPolling();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
