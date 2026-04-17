// Simple Express server for production deployment
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from build/client directory
app.use(express.static(path.join(__dirname, 'build/client')));

// Handle React Router routes - send all requests to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build/client/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access your app at http://localhost:${PORT}`);
});

// Note: This is a fallback server. 
// For production, use the official Remix server: npm start