
import http from 'http';

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/auth/shutdown',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => {});
  res.on('end', () => console.log('Shutdown completed.'));
});

req.on('error', (e) => console.log(`Error: ${e.message}`));
req.end();
