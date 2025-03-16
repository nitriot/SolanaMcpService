/**
 * Example MCP client for Solana interaction
 * Shows how an AI model like Claude could interact with Solana blockchain
 */

const WebSocket = require('ws');
const axios = require('axios');

// MCP Server configuration
const MCP_SERVER_URL = 'http://localhost:3000';
const MCP_WS_URL = 'ws://localhost:3000';

/**
 * Example of using REST API for MCP operations
 */
async function exampleRestApiRequests() {
  try {
    console.log('--- Example REST API Requests ---');
    
    // Get network status
    console.log('\nGetting network status...');
    const networkResponse = await axios.get(`${MCP_SERVER_URL}/api/network`);
    console.log('Network status:', networkResponse.data);
    
    // Create a wallet
    console.log('\nCreating a new wallet...');
    const walletResponse = await axios.post(`${MCP_SERVER_URL}/api/wallet/create`);
    console.log('New wallet created:', walletResponse.data);
    
    // Get balance (use the newly created wallet)
    const address = walletResponse.data.publicKey;
    console.log(`\nGetting balance for ${address}...`);
    const balanceResponse = await axios.get(`${MCP_SERVER_URL}/api/balance/${address}`);
    console.log('Balance:', balanceResponse.data);
    
    // Execute an MCP command
    console.log('\nExecuting MCP command...');
    const mcpResponse = await axios.post(`${MCP_SERVER_URL}/api/mcp/execute`, {
      action: 'getNetworkStatus',
      parameters: {}
    });
    console.log('MCP response:', mcpResponse.data);
    
  } catch (error) {
    console.error('Error in REST API examples:', error.message);
  }
}

/**
 * Example of using WebSocket for MCP operations
 */
function exampleWebSocketRequests() {
  return new Promise((resolve) => {
    console.log('\n--- Example WebSocket Requests ---');
    
    const ws = new WebSocket(MCP_WS_URL);
    let messageCounter = 0;
    
    ws.on('open', () => {
      console.log('\nWebSocket connected');
      
      // MCP request: Get network status
      ws.send(JSON.stringify({
        type: 'mcp',
        data: {
          requestId: 'req-1',
          action: 'getNetworkStatus',
          parameters: {}
        }
      }));
      
      // Wait a bit and send another request
      setTimeout(() => {
        // MCP request: Get balance
        ws.send(JSON.stringify({
          type: 'mcp',
          data: {
            requestId: 'req-2',
            action: 'getBalance',
            parameters: {
              address: 'ALJtSfWkr7kCJeXEDikxVfYxSShU9b6gWe19RSVVdXrp'
            }
          }
        }));
      }, 1000);
    });
    
    ws.on('message', (message) => {
      const data = JSON.parse(message);
      console.log(`\nReceived WebSocket message:`, data);
      
      messageCounter++;
      if (messageCounter >= 3) { // Connection message + 2 responses
        ws.close();
        resolve();
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error.message);
      ws.close();
      resolve();
    });
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });
}

/**
 * Main example function
 */
async function runExamples() {
  console.log('Starting Solana MCP Client Examples...');
  
  // Run REST API examples
  await exampleRestApiRequests();
  
  // Run WebSocket examples
  await exampleWebSocketRequests();
  
  console.log('\nAll examples completed!');
}

// Run the examples
runExamples().catch(console.error);
