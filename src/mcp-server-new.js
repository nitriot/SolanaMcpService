// Solana MCP Server Implementation using official MCP SDK
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { solanaAPI } from './solana-api.js';
import { config } from './config.js';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Import PumpFun API functions
import { createPumpFunToken } from './pumpfun.js';

// Force console.log to use stderr to avoid interfering with MCP messages
const originalConsoleLog = console.log;
console.log = (...args) => console.error(...args);

// Server start time for uptime tracking
const serverStartTime = new Date();

// Create MCP server instance
const server = new McpServer({
  name: config.server.name,
  version: config.server.version
});

// Add Solana network status tool
server.tool(
  'getNetworkStatus',
  {},
  async () => {
    try {
      const status = await solanaAPI.getNetworkStatus();
      return {
        content: [{ type: 'text', text: JSON.stringify(status, null, 2) }]
      };
    } catch (error) {
      console.error(`Error in getNetworkStatus: ${error.message}`);
      return {
        content: [{ type: 'text', text: `Error getting network status: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Add get balance tool
server.tool(
  'getBalance',
  { address: z.string().min(32).max(44) },
  async ({ address }) => {
    try {
      const balance = await solanaAPI.getBalance(address);
      return {
        content: [{ type: 'text', text: JSON.stringify(balance, null, 2) }]
      };
    } catch (error) {
      console.error(`Error in getBalance: ${error.message}`);
      return {
        content: [{ type: 'text', text: `Error getting balance: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Add account info tool
server.tool(
  'getAccountInfo',
  { address: z.string().min(32).max(44) },
  async ({ address }) => {
    try {
      const accountInfo = await solanaAPI.getAccountInfo(address);
      return {
        content: [{ type: 'text', text: JSON.stringify(accountInfo, null, 2) }]
      };
    } catch (error) {
      console.error(`Error in getAccountInfo: ${error.message}`);
      return {
        content: [{ type: 'text', text: `Error getting account info: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Add get transactions tool
server.tool(
  'getTransactions',
  { 
    address: z.string().min(32).max(44),
    limit: z.number().int().positive().max(100).optional().default(10)
  },
  async ({ address, limit }) => {
    try {
      const transactions = await solanaAPI.getTransactions(address, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(transactions, null, 2) }]
      };
    } catch (error) {
      console.error(`Error in getTransactions: ${error.message}`);
      return {
        content: [{ type: 'text', text: `Error getting transactions: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Add transfer SOL tool
server.tool(
  'transferSol',
  {
    from: z.string().min(32).max(44),
    to: z.string().min(32).max(44),
    amount: z.number().positive(),
    privateKey: z.string().min(87).max(88) // Base58 encoded private key
  },
  async ({ from, to, amount, privateKey }) => {
    try {
      const result = await solanaAPI.transferSol(from, to, amount, privateKey);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      console.error(`Error in transferSol: ${error.message}`);
      return {
        content: [{ type: 'text', text: `Error transferring SOL: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Add token balance tool
server.tool(
  'getTokenBalance',
  {
    address: z.string().min(32).max(44),
    mintAddress: z.string().min(32).max(44)
  },
  async ({ address, mintAddress }) => {
    try {
      const tokenBalance = await solanaAPI.getTokenBalance(address, mintAddress);
      return {
        content: [{ type: 'text', text: JSON.stringify(tokenBalance, null, 2) }]
      };
    } catch (error) {
      console.error(`Error in getTokenBalance: ${error.message}`);
      return {
        content: [{ type: 'text', text: `Error getting token balance: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Add create wallet tool
server.tool(
  'createWallet',
  {},
  async () => {
    try {
      const wallet = solanaAPI.createWallet();
      return {
        content: [{ type: 'text', text: JSON.stringify(wallet, null, 2) }]
      };
    } catch (error) {
      console.error(`Error in createWallet: ${error.message}`);
      return {
        content: [{ type: 'text', text: `Error creating wallet: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Add PumpFun tools

// Add create PumpFun token tool
server.tool(
  'createPumpFunToken',
  {
    name: z.string().min(1),
    symbol: z.string().min(1),
    description: z.string().optional().default(''),
    imagePath: z.string().optional(), // Local image path
    imageBase64: z.string().optional(), // Base64
    twitter: z.string().optional(),
    telegram: z.string().optional(),
    website: z.string().optional(),
    amount: z.string().optional().default('0.1'),
    slippage: z.string().optional().default('10'),
    priorityFee: z.string().optional().default('0.0005'),
    privateKey: z.string().optional() // Optional, will use env var if not provided
  },
  async ({ name, symbol, description, imagePath, imageBase64, twitter, telegram, website, amount, slippage, priorityFee, privateKey }) => {
    try {
      console.error(`Creating PumpFun token with parameters:`);
      console.error(`- name: ${name}`);
      console.error(`- symbol: ${symbol}`);
      console.error(`- description: ${description}`);
      console.error(`- imagePath: ${imagePath || 'undefined'}`);
      console.error(`- twitter: ${twitter || 'undefined'}`);
      console.error(`- telegram: ${telegram || 'undefined'}`);
      console.error(`- website: ${website || 'undefined'}`);
      console.error(`- amount: ${amount}`);
      console.error(`- imageBase64 provided: ${imageBase64 ? 'yes' : 'no'}`);
      console.error(`- privateKey provided: ${privateKey ? 'yes' : 'no'}`);
      console.error(`- Using env PUMPFUN_PRIVATE_KEY: ${!privateKey && process.env.PUMPFUN_PRIVATE_KEY ? 'yes' : 'no'}`);
      
      const result = await createPumpFunToken({
        name, 
        symbol, 
        description,
        imagePath,
        imageBase64,
        twitter,
        telegram,
        website,
        amount,
        slippage,
        priorityFee,
        privateKey
      });
      
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      console.error(`Error in createPumpFunToken: ${error.message}`);
      return {
        content: [{ type: 'text', text: `Error creating PumpFun token: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Create an HTTP server for monitoring and keeping the process alive
const httpServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'Solana MCP server is running',
      uptime: Math.floor((new Date() - serverStartTime) / 1000),
      started: serverStartTime.toISOString(),
      solanaNetwork: solanaAPI.network,
      solanaConnected: solanaAPI.connected
    }));
  } else if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`# MCP server metrics
      server_uptime_seconds ${Math.floor((new Date() - serverStartTime) / 1000)}
      server_memory_rss_bytes ${process.memoryUsage().rss}
      solana_connected ${solanaAPI.connected ? 1 : 0}
    `);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Start HTTP server and log port
const port = config.server.port || 0; // Use random port if not specified
httpServer.listen(port, () => {
  const actualPort = httpServer.address().port;
  console.error(`HTTP server started on port ${actualPort}`);
});

// Handle process shutdown
process.on('SIGINT', () => {
  console.error('Received SIGINT signal, shutting down gracefully');
  setTimeout(() => process.exit(0), 1000);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM signal, shutting down gracefully');
  setTimeout(() => process.exit(0), 1000);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`Uncaught exception: ${error.message}`, error.stack);
  // Don't exit - try to keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  // Don't exit - try to keep server running
});

// Start MCP server with stdio transport
const transport = new StdioServerTransport();
console.error('Starting Solana MCP server...');

// Connect server to transport
try {
  await server.connect(transport);
  console.error('MCP server connected to transport');
} catch (error) {
  console.error(`Failed to connect MCP server: ${error.message}`);
}
