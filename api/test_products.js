
import http from 'http';

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/product/list',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`BODY LENGTH: ${data.length}`);
    try {
      const json = JSON.parse(data);
      console.log(`IS ARRAY: ${Array.isArray(json)}`);
      if (Array.isArray(json)) {
        console.log(`COUNT: ${json.length}`);
        if(json.length > 0) console.log('FIRST ITEM:', JSON.stringify(json[0]));
      } else {
        console.log('RESPONSE:', data.substring(0, 200));
      }
    } catch (e) {
      console.log('INVALID JSON:', data.substring(0, 200));
    }
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
});

req.end();
