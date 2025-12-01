const { getDefaultConfig } = require('expo/metro-config');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

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

function createDevControlServer(lanIp) {
  try {
    if (process.env.EXPO_PUBLIC_DEV_CONTROL_URL) return;
    const server = http.createServer((req, res) => {
      try {
        const u = new URL(req.url, `http://${lanIp}:4005`);
        if (u.pathname === '/dev/start-api') {
          const t = (u.searchParams.get('target') || '').toLowerCase();
          const arg = t === 'local' ? 'local' : 'railway';
          try {
            const kill = spawn('bash', ['-lc', 'lsof -tiTCP:4000 | xargs kill -9 2>/dev/null || true'], { detached: true, stdio: 'ignore' });
            kill.unref();
          } catch {}
          try {
            const apiDir = path.resolve(__dirname, '..', 'api');
            const child = spawn('node', ['server.js'], {
              cwd: apiDir,
              detached: true,
              stdio: 'ignore',
              env: { ...process.env, DB_TARGET: arg },
            });
            child.unref();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, target: arg }));
            return;
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false }));
            return;
          }
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
      }
    });
    server.on('error', () => {});
    server.listen(4005, '0.0.0.0', () => {
      process.env.EXPO_PUBLIC_DEV_CONTROL_URL = `http://${lanIp}:4005`;
    });
  } catch {}
}

async function ensureApiRunning() {
  try {
    const lanIp = getLanIp();
    if (lanIp) {
      process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
      createDevControlServer(lanIp);
      // Expor a URL pública da API para o bundle
      process.env.EXPO_PUBLIC_API_URL = `http://${lanIp}:4000/api`;
      const healthy = await checkHealth(`http://${lanIp}:4000/api/health`, 1500);
      if (!healthy) {
        console.log('🔧 API não está ativa. Iniciando automaticamente com DB_TARGET=local...');
        const scriptPath = path.resolve(__dirname, '..', 'start-api.sh');
        // Ler alvo preferido do arquivo .env da API, se existir
        let preferredTarget = 'railway';
        try {
          const envPath = path.resolve(__dirname, '..', 'api', '.env');
          if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            const m = content.match(/DB_TARGET\s*=\s*(\w+)/i);
            if (m && /^(local|railway)$/i.test(m[1])) preferredTarget = m[1].toLowerCase();
          }
        } catch {}
        try {
          const child = spawn('bash', [scriptPath, preferredTarget], {
            cwd: path.resolve(__dirname, '..'),
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        } catch (e) {
          console.warn('⚠️ Falha ao iniciar API automaticamente:', e?.message || e);
          try {
            const apiDir = path.resolve(__dirname, '..', 'api');
            const node = spawn('node', ['server.js'], {
              cwd: apiDir,
              detached: true,
              stdio: 'ignore',
              env: { ...process.env, DB_TARGET: preferredTarget },
            });
            node.unref();
          } catch (e2) {
            console.warn('⚠️ Fallback direto também falhou:', e2?.message || e2);
          }
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