# ✨ Atmosphere Monitor

A lightweight, real-time dashboard for monitoring Tasmota PMS5003 particle sensors. Built for venue environments with clean dark theme and live-updating graphs.

## Features

- 🔄 **Real-time monitoring** - WebSocket-based live updates every 5 seconds
- 📊 **Live graphs** - Chart.js line charts with 60 data points per sensor
- 🎚️ **Customizable metrics** - Toggle individual PM and particle count metrics
- 🔀 **Drag-and-drop** - Rearrange sensor cards to your preference
- 💾 **Persistent preferences** - JSON file stores all settings
- 🌙 **Dark theme** - Easy on the eyes in low-light environments
- 🚀 **Auto-start** - launchd integration for macOS

## Requirements

- **Node.js** (v16 or higher)
- **macOS** (for launchd auto-start)
- **Tasmota sensors** with PMS5003 configured

## Installation

### 1. Install dependencies

```bash
cd ~/Projects/atmosphere-monitor
npm install
```

### 2. Test the server

```bash
npm start
```

Open http://localhost:3000 in your browser.

### 3. Set up auto-start (optional)

Copy the launchd plist to your LaunchAgents directory:

```bash
cp com.atmosphere-monitor.plist ~/Library/LaunchAgents/
```

**Important:** Edit the plist file first if your Node.js is not at `/usr/local/bin/node`:

```bash
which node  # Find your node path
nano ~/Library/LaunchAgents/com.atmosphere-monitor.plist
# Update the path in ProgramArguments
```

Load the service:

```bash
launchctl load ~/Library/LaunchAgents/com.atmosphere-monitor.plist
```

The service will now start automatically on login and restart if it crashes.

### Managing the service

```bash
# Check status
launchctl list | grep atmosphere-monitor

# Stop the service
launchctl unload ~/Library/LaunchAgents/com.atmosphere-monitor.plist

# Start the service
launchctl load ~/Library/LaunchAgents/com.atmosphere-monitor.plist

# View logs
tail -f ~/Projects/atmosphere-monitor/atmosphere-monitor.log
tail -f ~/Projects/atmosphere-monitor/atmosphere-monitor.error.log
```

## Usage

### Adding sensors

1. Click the **⚙️ Settings** button
2. Enter a name (e.g., "Living Room") and IP address (e.g., "192.168.1.100")
3. Click **Add Sensor**

### Customizing the dashboard

- **Rearrange cards**: Click and drag any sensor card
- **Toggle metrics**: Check/uncheck metrics at the bottom of each card
- **View readings**: Current PM1.0, PM2.5, and PM10 values at the top of each card

### Metrics explained

**Particulate Matter (µg/m³):**
- **PM1.0** - Particles < 1.0µm
- **PM2.5** - Particles < 2.5µm (health concern)
- **PM10** - Particles < 10µm

**Particle Counts (per 0.1L):**
- **PB0.3** - Particles > 0.3µm
- **PB0.5** - Particles > 0.5µm
- **PB1** - Particles > 1.0µm
- **PB2.5** - Particles > 2.5µm
- **PB5** - Particles > 5.0µm
- **PB10** - Particles > 10µm

By default, only PM metrics are shown. Enable particle counts if needed.

## Configuration

### Environment variables

Create a `.env` file or set environment variables:

```bash
PORT=3000              # Server port (default: 3000)
POLL_INTERVAL=5000     # Polling interval in ms (default: 5000)
```

### Database location

Data is stored in a JSON file at `~/Projects/atmosphere-monitor/sensors.json`

## Tasmota Setup

Your Tasmota devices must have PMS5003 sensors configured. The app polls:

```
http://<sensor-ip>/cm?cmnd=Status%2010
```

Expected JSON response:

```json
{
  "StatusSNS": {
    "Time": "2024-01-01T12:00:00",
    "PMS5003": {
      "CF1": 0,
      "CF2.5": 0,
      "CF10": 1,
      "PM1": 0,
      "PM2.5": 0,
      "PM10": 1,
      "PB0.3": 0,
      "PB0.5": 0,
      "PB1": 0,
      "PB2.5": 0,
      "PB5": 0,
      "PB10": 0
    }
  }
}
```

## Testing Without Real Sensors

Create a mock Tasmota server:

```bash
node scripts/mock-sensor.js
```

This starts a mock sensor at http://localhost:8080 that returns random data.

Add it to the dashboard with IP `localhost:8080`.

## Architecture

```
atmosphere-monitor/
├── backend/
│   ├── server.js      # Express + WebSocket server
│   ├── database.js    # SQLite operations
│   └── poller.js      # Tasmota HTTP polling
├── frontend/
│   ├── index.html     # Main HTML
│   ├── style.css      # Dark theme CSS
│   └── app.js         # WebSocket client + Chart.js
├── sensors.db         # SQLite database (created on first run)
└── com.atmosphere-monitor.plist  # launchd config
```

## Troubleshooting

### Sensor shows offline

- Verify the IP address is correct
- Check that the Tasmota device is on the same network
- Try accessing `http://<sensor-ip>/cm?cmnd=Status%2010` in your browser
- Check firewall settings

### Charts not updating

- Open browser console (F12) and check for WebSocket errors
- Verify the backend is running (`launchctl list | grep atmosphere`)
- Check logs: `tail -f ~/Projects/atmosphere-monitor/atmosphere-monitor.log`

### Auto-start not working

- Verify the node path in the plist: `which node`
- Check launchd logs: `launchctl list | grep atmosphere`
- Manually test: `launchctl start com.atmosphere-monitor`

## Limits

- **Maximum sensors**: 16
- **Chart history**: 60 data points (5 minutes at 5-second intervals)
- **Timeout per sensor**: 3 seconds
- **Network**: Local network only (no authentication)

## License

MIT
