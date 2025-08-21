const express = require('express');
const path = require('path');
const app = express();

// Serve static files from static-content at root
app.use(express.static(path.join(__dirname, 'static-content')));

// Serve JSON files from /data folder at /data route
app.use('/data', express.static(path.join(__dirname, 'data')));

// Optional: default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static-content', 'index.html'));
});

// Start server
const PORT = 80;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});