# Quick Start Guide

## 1. Install & Run

```bash
cd ~/Projects/atmosphere-monitor
npm install
npm start
```

Open http://localhost:3000 in your browser.

## 2. Add Your First Sensor

1. Click **⚙️ Settings**
2. Enter sensor name (e.g., "Living Room")
3. Enter sensor IP (e.g., "192.168.1.100")
4. Click **Add Sensor**

## 3. Test with Mock Data

In a separate terminal:

```bash
cd ~/Projects/atmosphere-monitor
node scripts/mock-sensor.js
```

Then add a sensor with IP: `localhost:8080`

## 4. Enable Auto-Start (Optional)

```bash
# Edit the plist to match your node path
which node  # Copy this path
nano com.atmosphere-monitor.plist  # Update <string>/path/to/node</string>

# Install the service
cp com.atmosphere-monitor.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.atmosphere-monitor.plist
```

## Tips

- **Rearrange cards**: Drag and drop
- **Toggle metrics**: Check/uncheck boxes at bottom of each card
- **View logs**: `tail -f atmosphere-monitor.log`
- **Change port**: `PORT=3001 npm start`

## Troubleshooting

**Sensor offline?**
- Verify IP is correct
- Try accessing `http://<sensor-ip>/cm?cmnd=Status%2010` in browser
- Check network connectivity

**Port already in use?**
```bash
lsof -ti:3000 | xargs kill -9
# or use different port
PORT=3001 npm start
```

**Auto-start not working?**
```bash
# Check service status
launchctl list | grep atmosphere-monitor

# View logs
tail -f ~/Projects/atmosphere-monitor/atmosphere-monitor.error.log
```
