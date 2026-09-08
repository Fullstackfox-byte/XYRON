const express = require('express');
const router = express.Router();
const os = require('os');
const net = require('net');

const COMMON_PORTS = [21, 22, 23, 25, 80, 443, 3306, 3389, 5432, 8080];

function checkPort(port, host = '127.0.0.1', timeout = 300) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = 'closed';
    socket.setTimeout(timeout);
    socket.once('connect', () => { status = 'open'; socket.destroy(); });
    socket.once('timeout', () => socket.destroy());
    socket.once('error', () => socket.destroy());
    socket.once('close', () => resolve({ port, status }));
    socket.connect(port, host);
  });
}

router.get('/', async (req, res) => {
  try {
    const portResults = await Promise.all(COMMON_PORTS.map((p) => checkPort(p)));
    const openPorts = portResults.filter((r) => r.status === 'open').map((r) => r.port);

    const netIfaces = Object.entries(os.networkInterfaces())
      .flatMap(([name, addrs]) => (addrs || [])
        .filter((a) => !a.internal)
        .map((a) => ({ name, address: a.address, family: a.family })));

    res.json({
      timestamp: new Date().toISOString(),
      hostname: os.hostname(),
      platform: `${os.platform()} ${os.release()}`,
      uptimeMinutes: Math.round(os.uptime() / 60),
      memory: {
        totalMB: Math.round(os.totalmem() / 1e6),
        freeMB: Math.round(os.freemem() / 1e6),
      },
      networkInterfaces: netIfaces,
      openPorts,
      status: openPorts.length > 0 ? 'ALERT' : 'SECURE',
    });
  } catch (err) {
    console.error('Scan failed:', err.message);
    res.status(500).json({ error: 'Scan failed.' });
  }
});

module.exports = router;
