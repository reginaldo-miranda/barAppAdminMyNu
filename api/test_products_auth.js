
import http from 'http';

function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      email: 'admin@barapp.com',
      password: '123456'
    });

    const options = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const json = JSON.parse(body);
          resolve(json.token);
        } else {
          reject('Login failed: ' + body);
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getProducts(token) {
  const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/api/product/list',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

  const req = http.request(options, (res) => {
    console.log(`PRODUCT LIST STATUS: ${res.statusCode}`);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (res.statusCode === 200) {
          console.log(`PRODUCTS COUNT: ${Array.isArray(json) ? json.length : 'Not array'}`);
          if (Array.isArray(json) && json.length > 0) {
            console.log('SAMPLE PRODUCT:', JSON.stringify(json[0]));
          }
        } else {
          console.log('ERROR BODY:', data);
        }
      } catch (e) {
        console.log('INVALID JSON:', data.substring(0, 200));
      }
    });
  });

  req.on('error', (e) => console.error('Request error:', e));
  req.end();
}

login()
  .then(token => {
    console.log('Login successful, got token.');
    getProducts(token);
  })
  .catch(err => console.error(err));
