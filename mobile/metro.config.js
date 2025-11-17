const { getDefaultConfig } = require('expo/metro-config');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// Detectar IP da LAN
function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (!iface.internal && iface.family === 'IPv4') {
        const ip = iface.address;
        if (
          ip.startsWith('192.168.') ||
          ip.startsWith('10.') ||
          (ip.startsWith('172.') && (() => {
            const n = parseInt(ip.split('.')[1], 10);
            return n >= 16 && n <= 31;
          })())
        ) {
          return ip;
        }
      }
    }
  }
  return '';
}

function checkHealth(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, (res) => {
        resolve(res.statusCode === 200);
        req.destroy();
      });
      req.on('error', () => resolve(false));
      req.setTimeout(timeoutMs, () => {
        try { req.destroy(); } catch {}
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

async function ensureApiRunning() {
  try {
    const lanIp = getLanIp();
    if (lanIp) {
      // Expor a URL pública da API para o bundle
      process.env.EXPO_PUBLIC_API_URL = `http://${lanIp}:4000/api`;
      const healthy = await checkHealth(`http://${lanIp}:4000/api/health`, 1500);
      if (!healthy) {
        console.log('🔧 API não está ativa. Iniciando automaticamente com DB_TARGET=local...');
        const scriptPath = path.resolve(__dirname, '..', 'start-api.sh');
        try {
          const child = spawn('bash', [scriptPath, 'local'], {
            cwd: path.resolve(__dirname, '..'),
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        } catch (e) {
          console.warn('⚠️ Falha ao iniciar API automaticamente:', e?.message || e);
        }
      } else {
        console.log('✅ API já está saudável em LAN.');
      }
    } else {
      console.warn('⚠️ Não foi possível detectar IP da LAN automaticamente.');
    }
  } catch (e) {
    console.warn('⚠️ ensureApiRunning error:', e?.message || e);
  }
}

// Disparar verificação/inicialização da API assim que o Metro carregar
ensureApiRunning();

const config = getDefaultConfig(__dirname);
module.exports = config;