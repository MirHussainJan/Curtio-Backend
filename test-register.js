const http = require('http');

const data = JSON.stringify({
  name: "Test",
  email: 'test' + Date.now() + '@example.com',
  password: 'password123'
});

const options = {
  hostname: 'localhost',
  port: 6090,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    body += d;
  });
  res.on('end', () => {
    console.log("Body:", body);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
