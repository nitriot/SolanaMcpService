// Final solution for creating PumpFun tokens based on official example

import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PumpFunSDK } from 'pumpdotfun-sdk';
import { AnchorProvider } from '@coral-xyz/anchor';
import fs from 'fs';
import bs58 from 'bs58';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create log file with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = fs.createWriteStream(`final-solution-${timestamp}.log`, { flags: 'a' });

// Advanced logging function
function log(message, data = null) {
  const ts = new Date().toISOString();
  let logMessage = `[${ts}] ${message}`;
  
  if (data !== null) {
    try {
      if (typeof data === 'object') {
        logMessage += `\n${JSON.stringify(data, null, 2)}`;
      } else {
        logMessage += ` ${data}`;
      }
    } catch (e) {
      logMessage += ` [Error stringifying object: ${e.message}]`;
    }
  }
  
  // Print to console and write to log file
  console.log(logMessage);
  logFile.write(logMessage + '\n');
}

async function main() {
  try {
    // Step 1: Log start and environment
    log('Starting PumpFun token creation with official approach');
    log(`Solana Network: ${process.env.SOLANA_NETWORK}`);
    
    if (!process.env.HELIUS_RPC_URL) {
      throw new Error('HELIUS_RPC_URL not found in environment variables');
    }
    
    if (!process.env.PUMPFUN_PRIVATE_KEY) {
      throw new Error('PUMPFUN_PRIVATE_KEY not found in environment variables');
    }
    
    // Step 2: Create connection
    log('Creating Solana connection');
    const connection = new Connection(process.env.HELIUS_RPC_URL, 'confirmed');
    
    // Step 3: Create wallet from private key
    const privateKeyBase58 = process.env.PUMPFUN_PRIVATE_KEY;
    const secretKey = bs58.decode(privateKeyBase58);
    const wallet = Keypair.fromSecretKey(secretKey);
    log(`Using wallet address: ${wallet.publicKey.toBase58()}`);
    
    // Step 4: Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.004 * LAMPORTS_PER_SOL) {
      throw new Error(`Insufficient funds. Need at least 0.004 SOL, current balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    }
    
    // Step 5: Create provider with proper wallet adapter
    log('Creating AnchorProvider with wallet adapter');
    const provider = new AnchorProvider(
      connection,
      {
        publicKey: wallet.publicKey,
        signTransaction: async (tx) => {
          tx.partialSign(wallet);
          return tx;
        },
        signAllTransactions: async (txs) => {
          return txs.map(tx => {
            tx.partialSign(wallet);
            return tx;
          });
        }
      },
      { commitment: 'confirmed' }
    );
    
    // Step 6: Create SDK instance
    log('Creating PumpFunSDK instance');
    const sdk = new PumpFunSDK(provider);
    
    // Step 7: Check if test image exists
    const imagePath = 'example/basic/test.jpg'; // Use relative path as in the official example
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Test image not found at path: ${imagePath}`);
    }
    log(`Found test image: ${imagePath}`);
    
    // Step 8: Generate mint keypair
    const mint = Keypair.generate();
    log(`Generated mint keypair: ${mint.publicKey.toBase58()}`);
    
    // Step 9: Prepare token metadata (exactly as in official example)
    const tokenMetadata = {
      name: 'Final Test Token',
      symbol: 'FTT',
      description: 'A test token created following the official example',
      filePath: imagePath // Use relative path as string (NOT as object or blob)
    };
    log('Prepared token metadata', tokenMetadata);
    
    // Step 10: Create and buy token
    log('Creating and buying token...');
    try {
      // Use exact same values as in official example
      const buyAmountSol = BigInt(0.0001 * LAMPORTS_PER_SOL);
      const slippageBasisPoints = 100n;
      const priorityFees = {
        unitLimit: 250000,
        unitPrice: 250000
      };
      
      log(`Buy amount: ${Number(buyAmountSol) / LAMPORTS_PER_SOL} SOL`);
      log(`Slippage: ${slippageBasisPoints} basis points`);
      log('Priority fees:', priorityFees);
      
      const createResults = await sdk.createAndBuy(
        wallet,
        mint,
        tokenMetadata,
        buyAmountSol,
        slippageBasisPoints,
        priorityFees
      );
      
      if (createResults.success) {
        const tokenUrl = `https://pump.fun/${mint.publicKey.toBase58()}`;
        log(`Token created successfully! URL: ${tokenUrl}`);
        log('Transaction result:', createResults);
      } else {
        log('Token creation failed', createResults);
      }
    } catch (error) {
      log(`Error during createAndBuy: ${error.message}`);
      
      // Check for transaction logs
      if (error.logs) {
        log('Transaction logs:');
        error.logs.forEach((logLine, i) => {
          log(`Log ${i}: ${logLine}`);
        });
      }
      
      // Log full error details
      log('Full error object:', error);
      log(`Error stack trace:\n${error.stack}`);
    }
  } catch (error) {
    log(`Fatal error: ${error.message}`);
    log(`Error stack trace:\n${error.stack}`);
  } finally {
    log('Test completed');
    logFile.end();
  }
}

// Run the main function
main();
