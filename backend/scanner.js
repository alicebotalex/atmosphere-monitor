const http = require('http');
const os = require('os');

/**
 * Detect local subnet from network interfaces
 */
function detectLocalSubnet() {
  const interfaces = os.networkInterfaces();
  const subnets = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal, IPv6, and VPN interfaces
      if (iface.internal || iface.family !== 'IPv4' || name.includes('utun')) {
        continue;
      }
      
      const ip = iface.address;
      const match = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
      if (match) {
        subnets.push(match[1]);
      }
    }
  }
  
  // Fallback to common ranges if detection fails
  if (subnets.length === 0) {
    return ['192.168.1', '192.168.0'];
  }
  
  return subnets;
}

/**
 * Probe a single IP for Tasmota PMS5003 data
 */
function probeTasmotaDevice(ip, timeout = 800) {
  return new Promise((resolve) => {
    const options = {
      hostname: ip,
      port: 80,
      path: '/cm?cmnd=Status%2010',
      method: 'GET',
      timeout: timeout,
      headers: {
        'Connection': 'close'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Check if response contains PMS5003 data
          if (json.StatusSNS && json.StatusSNS.PMS5003) {
            resolve({ ip, found: true, data: json.StatusSNS.PMS5003 });
          } else {
            resolve({ ip, found: false });
          }
        } catch (e) {
          resolve({ ip, found: false });
        }
      });
    });
    
    req.on('error', () => {
      resolve({ ip, found: false });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ ip, found: false });
    });
    
    req.end();
  });
}

/**
 * Scan a subnet range in parallel batches
 */
async function scanSubnet(subnet, onProgress) {
  const batchSize = 20; // Scan 20 IPs at a time
  const results = [];
  const totalIps = 254;
  let scanned = 0;
  
  for (let batch = 0; batch < Math.ceil(254 / batchSize); batch++) {
    const batchPromises = [];
    const start = batch * batchSize + 1;
    const end = Math.min(start + batchSize, 255);
    
    for (let i = start; i < end; i++) {
      const ip = `${subnet}.${i}`;
      batchPromises.push(probeTasmotaDevice(ip));
    }
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(r => r.found));
    
    scanned += batchResults.length;
    if (onProgress) {
      onProgress(scanned, totalIps);
    }
  }
  
  return results;
}

/**
 * Scan all local subnets for Tasmota devices
 */
async function scanNetwork(onProgress) {
  const subnets = detectLocalSubnet();
  console.log('Scanning subnets:', subnets);
  
  const allResults = [];
  let totalScanned = 0;
  const totalIps = subnets.length * 254;
  
  for (const subnet of subnets) {
    const results = await scanSubnet(subnet, (scanned, total) => {
      totalScanned = (subnets.indexOf(subnet) * 254) + scanned;
      if (onProgress) {
        onProgress(totalScanned, totalIps, subnet);
      }
    });
    allResults.push(...results);
  }
  
  return allResults;
}

module.exports = {
  scanNetwork,
  detectLocalSubnet
};
