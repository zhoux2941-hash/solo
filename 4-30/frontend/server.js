const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3000;

app.use(express.static('public'));

app.use('/api', createProxyMiddleware({
  target: 'http://localhost:8080',
  changeOrigin: true,
  ws: false
}));

app.use('/ws', createProxyMiddleware({
  target: 'ws://localhost:8080',
  ws: true,
  changeOrigin: true
}));

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/editor/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'editor.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on http://localhost:${PORT}`);
  console.log(`Login page: http://localhost:${PORT}/login`);
});
