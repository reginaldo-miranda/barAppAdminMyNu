
import http from 'http';

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/health',
  method: 'GET',
  timeout: 2000
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.log('API_OFFLINE');
});

req.on('timeout', () => {
  req.destroy();
  console.log('API_TIMEOUT');
});

req.end();
