const http = require('http');

const PORT = 8080;

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMockData() {
  return {
    StatusSNS: {
      Time: new Date().toISOString(),
      PMS5003: {
        CF1: getRandomInt(0, 5),
        'CF2.5': getRandomInt(0, 10),
        CF10: getRandomInt(0, 15),
        PM1: getRandomInt(0, 5),
        'PM2.5': getRandomInt(5, 25),
        PM10: getRandomInt(10, 50),
        'PB0.3': getRandomInt(100, 1000),
        'PB0.5': getRandomInt(50, 500),
        PB1: getRandomInt(20, 200),
        'PB2.5': getRandomInt(10, 100),
        PB5: getRandomInt(5, 50),
        PB10: getRandomInt(1, 10)
      }
    }
  };
}

const server = http.createServer((req, res) => {
  if (req.url.includes('/cm?cmnd=Status')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(generateMockData()));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Mock Tasmota sensor running at http://localhost:${PORT}`);
  console.log(`Add this sensor to your dashboard with IP: localhost:${PORT}`);
});
