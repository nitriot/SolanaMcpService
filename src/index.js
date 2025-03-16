const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { initialize } = require('./solana');
const { setupRoutes } = require('./routes');
const { initializeMcpTools } = require('./mcp');
require('dotenv').config();

// Initialize the express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Solana connection
const solanaConnection = initialize();

// Initialize MCP tools
const mcpTools = initializeMcpTools(solanaConnection);

// Set up API routes
setupRoutes(app, solanaConnection);

// Serve static files
app.use(express.static('public'));

// Start the HTTP server
const server = app.listen(PORT, () => {
  console.log(`Solana MCP server running on port ${PORT}`);
});

// Set up WebSocket server for real-time updates
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  
  // Send initial connection message
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to Solana MCP WebSocket'
  }));
  
  // Handle client messages
  ws.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      console.log('Received WebSocket message:', parsedMessage);
      
      // Handle different message types
      switch (parsedMessage.type) {
        case 'subscribe':
          // Subscribe to specific blockchain events
          break;
        case 'mcp':
          // Handle MCP specific messages
          mcpTools.handleWebSocketMessage(ws, parsedMessage.data);
          break;
        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Unknown message type'
          }));
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Handle server shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = { app, server };
