const fs = require('fs');
const path = require('path');
const os = require('os');

// New config directory location
const configDir = path.join(os.homedir(), '.config', 'atmosphere-monitor');
const dbPath = path.join(configDir, 'sensors.json');

// Old location for migration
const oldDbPath = path.join(__dirname, '..', 'sensors.json');

// Ensure config directory exists
function ensureConfigDir() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log(`Created config directory: ${configDir}`);
  }
}

// Migrate old database if it exists
function migrateOldDatabase() {
  if (fs.existsSync(oldDbPath) && !fs.existsSync(dbPath)) {
    console.log('Migrating settings from project directory to ~/.config/atmosphere-monitor/');
    fs.copyFileSync(oldDbPath, dbPath);
    console.log(`Settings migrated to ${dbPath}`);
    console.log('You can safely delete the old sensors.json from the project directory');
  }
}

// Initialize database file
function initDatabase() {
  ensureConfigDir();
  migrateOldDatabase();
  
  if (!fs.existsSync(dbPath)) {
    const initialData = {
      sensors: [],
      preferences: {
        cardOrder: [],
        metricToggles: {},
        chartTimeWindow: 60 // Default: 1 hour in minutes
      },
      nextId: 1
    };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
    console.log(`Initialized database at ${dbPath}`);
  }
}

function readDatabase() {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    const db = JSON.parse(data);
    
    // Ensure preferences has chartTimeWindow
    if (!db.preferences) {
      db.preferences = { cardOrder: [], metricToggles: {}, chartTimeWindow: 60 };
    }
    if (db.preferences.chartTimeWindow === undefined) {
      db.preferences.chartTimeWindow = 60;
    }
    
    return db;
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
  return db.preferences || { cardOrder: [], metricToggles: {}, chartTimeWindow: 60 };
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
