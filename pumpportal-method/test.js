// Pump.fun Token Creation Test Script using PumpPortal.fun API
// Author: Codeium
// Date: 2025-03-15

import { createTokenLightning, createTokenLocal } from './index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const API_KEY = process.env.PUMPFUN_API_KEY || 'your-api-key'; // Optional API key for Lightning method
// Get private key from env or use hardcoded key for testing
let privateKey = process.env.PUMPFUN_PRIVATE_KEY; 
if (!privateKey) {
  console.log(`No private key found in environment. Setting manually.`);
  privateKey = 'your private key';
}
const IMAGE_PATH = path.resolve(__dirname, '../example/basic/random.png');

// Logging function
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Debug the environment variables
log(`Environment check:`);
log(`PUMPFUN_PRIVATE_KEY exists: ${process.env.PUMPFUN_PRIVATE_KEY ? 'YES' : 'NO'}`);
log(`PUMPFUN_PRIVATE_KEY length: ${process.env.PUMPFUN_PRIVATE_KEY ? process.env.PUMPFUN_PRIVATE_KEY.length : 0}`);
log(`HELIUS_RPC_URL exists: ${process.env.HELIUS_RPC_URL ? 'YES' : 'NO'}`);
log(`HELIUS_RPC_URL value: ${process.env.HELIUS_RPC_URL || 'Not set'}`);
log(`Using private key with length: ${privateKey ? privateKey.length : 0}`);

// Fix the HELIUS_RPC_URL if it's incorrectly formatted
if (process.env.HELIUS_RPC_URL && !process.env.HELIUS_RPC_URL.startsWith('http')) {
  process.env.HELIUS_RPC_URL = your rpc url;
  log(`Fixed HELIUS_RPC_URL to: ${process.env.HELIUS_RPC_URL}`);
}

// Manually set the key if environment variable is not available
if (!privateKey) {
  log(`No private key found in environment. Setting manually.`);
  privateKey = 'your private key';
}

// Test token creation using Lightning Transaction method
async function testLightningMethod() {
  log('\n---------- TESTING LIGHTNING TRANSACTION METHOD ----------');
  
  if (!API_KEY || API_KEY === 'your-api-key') {
    log('Warning: No API key found in environment variables. This test may fail.');
    log('Set PUMPFUN_API_KEY in your .env file to run this test.\n');
    return;
  }
  
  const tokenMetadata = {
    name: 'PumpPortal Test',
    symbol: 'PPT',
    description: 'Testing PumpPortal.fun API for token creation',
    website: 'https://example.com',
    twitter: 'https://twitter.com/example',
    telegram: 'https://t.me/example',
    showName: 'true'
  };
  
  const options = {
    metadata: tokenMetadata,
    apiKey: API_KEY,
    imagePath: IMAGE_PATH,
    amount: 0.01, // 0.1 SOL for dev buy
    slippage: 10,
    priorityFee: 0.0005
  };
  
  log('Creating token with the following options:');
  log(`Name: ${options.metadata.name}`);
  log(`Symbol: ${options.metadata.symbol}`);
  log(`Description: ${options.metadata.description}`);
  log(`Image: ${options.imagePath}`);
  log(`Amount: ${options.amount} SOL`);
  
  try {
    const result = await createTokenLightning(options);
    
    if (result.success) {
      log('\n✅ Token creation successful!');
      log(`Transaction: ${result.transaction}`);
      log(`Token Address: ${result.token}`);
      log(`Token URL: ${result.tokenUrl}`);
    } else {
      log('\n❌ Token creation failed:');
      log(`Error: ${result.error}`);
      if (result.details) {
        log(`Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    }
  } catch (error) {
    log(`\n❌ Unexpected error: ${error.message}`);
  }
}

// Test token creation using Local Transaction method
async function testLocalMethod() {
  log('\n---------- TESTING LOCAL TRANSACTION METHOD ----------');
  
  if (!privateKey) {
    log('Warning: No private key found in environment variables. This test will fail.');
    log('Set PUMPFUN_PRIVATE_KEY in your .env file to run this test.\n');
    return;
  }
  
  const tokenMetadata = {
    name: 'PumpPortal Local Test',
    symbol: 'PPLT',
    description: 'Testing PumpPortal.fun API local transaction method',
    website: 'https://example.com',
    twitter: 'https://twitter.com/example',
    telegram: 'https://t.me/example',
    showName: 'true'
  };
  
  const options = {
    metadata: tokenMetadata,
    privateKey: privateKey,
    imagePath: IMAGE_PATH,
    amount: 0.1, // 0.1 SOL for dev buy
    slippage: 10,
    priorityFee: 0.0005
  };
  
  log('Creating token with the following options:');
  log(`Name: ${options.metadata.name}`);
  log(`Symbol: ${options.metadata.symbol}`);
  log(`Description: ${options.metadata.description}`);
  log(`Image: ${options.imagePath}`);
  log(`Amount: ${options.amount} SOL`);
  
  try {
    const result = await createTokenLocal(options);
    
    if (result.success) {
      log('\n✅ Token creation successful!');
      log(`Transaction: ${result.transaction}`);
      log(`Token Address: ${result.token}`);
      log(`Token URL: ${result.tokenUrl}`);
    } else {
      log('\n❌ Token creation failed:');
      log(`Error: ${result.error}`);
      if (result.details) {
        log(`Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    }
  } catch (error) {
    log(`\n❌ Unexpected error: ${error.message}`);
  }
}

// Main function to run tests
async function runTests() {
  log('Starting PumpPortal.fun API tests...');
  
  // Uncomment the test you want to run
  // await testLightningMethod();
  await testLocalMethod();
  
  log('\nTests completed!');
}

// Run the tests
runTests();
