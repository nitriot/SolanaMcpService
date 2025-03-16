// Configuration module for Solana MCP server
import dotenv from 'dotenv';
const result = dotenv.config();

// Log environment loading status
console.error(`Loading .env file: ${result.error ? 'FAILED: ' + result.error.message : 'SUCCESS'}`);
console.error(`Environment SOLANA_NETWORK = ${process.env.SOLANA_NETWORK}`);

export const config = {
  // Server settings
  server: {
    name: process.env.MCP_SERVER_NAME || 'solana-mcp',
    version: process.env.MCP_SERVER_VERSION || '1.0.0',
    port: parseInt(process.env.MCP_SERVER_PORT || '0', 10),
    logLevel: process.env.LOG_LEVEL || 'INFO'
  },
  
  // Solana settings
  solana: {
    network: process.env.SOLANA_NETWORK || 'devnet',
    endpoints: {
      'mainnet-beta': [
        process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'https://solana-api.projectserum.com',
        'https://rpc.ankr.com/solana'
      ],
      'devnet': [
        process.env.DEVNET_RPC_URL || 'https://api.devnet.solana.com',
        'https://devnet.genesysgo.net'
      ],
      'testnet': [
        process.env.TESTNET_RPC_URL || 'https://api.testnet.solana.com'
      ],
      'localnet': [
        'http://localhost:8899'
      ]
    },
    commitment: process.env.SOLANA_COMMITMENT || 'confirmed'
  },
  
  // PumpFun settings
  pumpfun: {
    privateKey: process.env.PUMPFUN_PRIVATE_KEY || ''
  }
};

// Log config values
console.error(`Config SOLANA_NETWORK = ${config.solana.network}`);
