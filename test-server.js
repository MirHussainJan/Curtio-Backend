const express = require("express");
const connectDB = require("./config.js/db");
const authRoutes = require("./modules/auth.routes");
const env = require("./config.js/env");

const app = express();
app.use(express.json());

app.use("/api/auth", authRoutes);

connectDB().then(() => {
  const server = app.listen(6092, () => {
    console.log("Test server running on 6092");

    const http = require('http');
    const data = JSON.stringify({
      email: 'test@example.com',
      password: 'wrong'
    });

    const options = {
      hostname: 'localhost',
      port: 6092,
      path: '/api/auth/login',
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
        server.close();
        process.exit(0);
      });
    });

    req.on('error', error => {
      console.error(error);
    });

    req.write(data);
    req.end();
  });
});
