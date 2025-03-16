// u8be6u7ec6u8c03u8bd5PumpFunu4ee3u5e01u521bu5efau95eeu9898
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PumpFunSDK } from 'pumpdotfun-sdk';
import { AnchorProvider } from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';
import bs58 from 'bs58';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create log file
const logFile = fs.createWriteStream('debug-token-creation.log', { flags: 'a' });

// Enhanced logging function
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] ${message}`;
  
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
  
  console.log(logMessage);
  logFile.write(logMessage + '\n');
}

// Check if file exists
function checkFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    log(`Error: File not found: ${filePath}`);
    return false;
  }
  
  // Get file info
  const stats = fs.statSync(filePath);
  log(`File exists: ${filePath}, Size: ${stats.size} bytes, Last modified: ${stats.mtime}`);
  return true;
}

// Main function
async function main() {
  try {
    // Step 1: Verify environment setup
    log(`Starting token creation debug test`);
    log(`Solana Network: ${process.env.SOLANA_NETWORK}`);
    log(`Helius RPC URL: ${process.env.HELIUS_RPC_URL ? 'Set (Hidden for security)' : 'Not set'}`);
    log(`PUMPFUN_PRIVATE_KEY: ${process.env.PUMPFUN_PRIVATE_KEY ? 'Set (Hidden for security)' : 'Not set'}`);
    
    // Step 2: Create connection
    log('Creating connection to Solana network');
    const connection = new Connection(process.env.HELIUS_RPC_URL);
    log('Connection created');
    
    // Step 3: Setup wallet from private key
    const privateKeyBase58 = process.env.PUMPFUN_PRIVATE_KEY;
    if (!privateKeyBase58) {
      throw new Error('Private key not found in environment variables');
    }
    
    try {
      const secretKey = bs58.decode(privateKeyBase58);
      log(`Secret key decoded, length: ${secretKey.length} bytes`);
      
      const wallet = Keypair.fromSecretKey(secretKey);
      log(`Wallet created, Public key: ${wallet.publicKey.toBase58()}`);
      
      // Step 4: Check balance
      const balance = await connection.getBalance(wallet.publicKey);
      log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
      
      if (balance < 0.004 * LAMPORTS_PER_SOL) {
        throw new Error(`Insufficient funds! Need at least 0.004 SOL, current balance: ${balance / LAMPORTS_PER_SOL} SOL`);
      }
      
      // Step 5: Create AnchorProvider with wallet
      log('Creating AnchorProvider');
      const provider = new AnchorProvider(
        connection, 
        {
          publicKey: wallet.publicKey,
          signTransaction: async (tx) => {
            log('Signing transaction');
            tx.partialSign(wallet);
            return tx;
          },
          signAllTransactions: async (txs) => {
            log(`Signing ${txs.length} transactions`);
            return txs.map(tx => {
              tx.partialSign(wallet);
              return tx;
            });
          }
        },
        { commitment: 'confirmed' }
      );
      log('AnchorProvider created');
      
      // Step 6: Create PumpFunSDK instance
      log('Creating PumpFunSDK instance');
      const sdk = new PumpFunSDK(provider);
      log('PumpFunSDK instance created');
      
      // Step 7: Verify test image exists
      const testImagePath = path.resolve('example', 'basic', 'test.jpg');
      if (!checkFileExists(testImagePath)) {
        throw new Error(`Test image does not exist: ${testImagePath}`);
      }
      
      // Step 8: Create mint keypair
      const mint = Keypair.generate();
      log(`Generated mint keypair with public key: ${mint.publicKey.toBase58()}`);
      
      // Step 9: Prepare token metadata
      const tokenMetadata = {
        name: 'Debug Test Token',
        symbol: 'DTT',
        description: 'A token for debugging PumpFun token creation',
        filePath: testImagePath
      };
      log('Prepared token metadata:', tokenMetadata);
      
      // Step 10: Create and buy token
      log('Starting token creation and initial buy...');
      try {
        const createResults = await sdk.createAndBuy(
          wallet,
          mint,
          tokenMetadata,
          BigInt(0.0001 * LAMPORTS_PER_SOL),
          100n,
          {
            unitLimit: 250000,
            unitPrice: 250000
          }
        );
        
        if (createResults.success) {
          log(`Token created successfully! URL: https://pump.fun/${mint.publicKey.toBase58()}`);
        } else {
          log('Token creation failed:', createResults);
        }
      } catch (error) {
        log(`Error during createAndBuy operation: ${error.message}`);
        
        // Check for transaction logs
        if (error.logs) {
          log('Transaction logs:');
          error.logs.forEach((logEntry, i) => {
            log(`Log ${i}: ${logEntry}`);
          });
        }
        
        if (error.stack) {
          log(`Error stack trace:\n${error.stack}`);
        }
      }
    } catch (error) {
      log(`Error setting up wallet: ${error.message}`);
      throw error;
    }
  } catch (error) {
    log(`Fatal error: ${error.message}`);
    log(`Error stack trace:\n${error.stack}`);
  } finally {
    log('Test completed');
    logFile.end();
  }
}

// Run the program
main();
