const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'sensors.json');

// Initialize database file
function initDatabase() {
  if (!fs.existsSync(dbPath)) {
    const initialData = {
      sensors: [],
      preferences: {
        cardOrder: [],
        metricToggles: {}
      },
      nextId: 1
    };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
  }
}

function readDatabase() {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    initDatabase();
    return readDatabase();
  }
}

function writeDatabase(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Sensors CRUD
function getSensors() {
  const db = readDatabase();
  return db.sensors;
}

function addSensor(name, ip) {
  const db = readDatabase();
  const sensor = {
    id: db.nextId++,
    name,
    ip,
    created_at: new Date().toISOString()
  };
  db.sensors.push(sensor);
  writeDatabase(db);
  return sensor;
}

function updateSensor(id, name, ip) {
  const db = readDatabase();
  const sensor = db.sensors.find(s => s.id === parseInt(id));
  if (sensor) {
    if (name !== undefined) sensor.name = name;
    if (ip !== undefined) sensor.ip = ip;
    writeDatabase(db);
  }
}

function deleteSensor(id) {
  const db = readDatabase();
  db.sensors = db.sensors.filter(s => s.id !== parseInt(id));
  writeDatabase(db);
}

// Preferences
function getPreferences() {
  const db = readDatabase();
  return db.preferences || { cardOrder: [], metricToggles: {} };
}

function updatePreferences(preferences) {
  const db = readDatabase();
  db.preferences = { ...db.preferences, ...preferences };
  writeDatabase(db);
}

// Initialize on load
initDatabase();

module.exports = {
  getSensors,
  addSensor,
  updateSensor,
  deleteSensor,
  getPreferences,
  updatePreferences
};
