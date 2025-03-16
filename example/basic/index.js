// Official PumpFun SDK test example - Based on official documentation
import dotenv from 'dotenv';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { DEFAULT_DECIMALS, PumpFunSDK } from 'pumpdotfun-sdk';
import { AnchorProvider } from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getOrCreateKeypair,
  getSPLBalance,
  printSOLBalance,
  printSPLBalance,
} from './util.js';

// Load environment variables
dotenv.config();

// Constants - Using dirname for ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KEYS_FOLDER = path.join(__dirname, '.keys');
const SLIPPAGE_BASIS_POINTS = 100n;

// Get provider with connection to Solana network
const getProvider = () => {
  if (!process.env.HELIUS_RPC_URL) {
    throw new Error('Please set HELIUS_RPC_URL in .env file');
  }

  const connection = new Connection(process.env.HELIUS_RPC_URL || '');
  
  // Create a simple compatible wallet object for AnchorProvider
  const wallet = {
    publicKey: Keypair.generate().publicKey,
    signTransaction: () => Promise.reject(new Error('signTransaction not implemented')),
    signAllTransactions: () => Promise.reject(new Error('signAllTransactions not implemented')),
  };
  
  return new AnchorProvider(connection, wallet, { commitment: 'finalized' });
};

// Create and buy token function
const createAndBuyToken = async (sdk, testAccount, mint) => {
  // Token metadata - using the exact structure from official example
  const tokenMetadata = {
    name: 'TST-7',
    symbol: 'TST-7',
    description: 'TST-7: This is a test token',
    filePath: 'example/basic/test.jpg', // Using the existing test.jpg file
  };

  console.log('Creating token with metadata:', tokenMetadata);
  console.log('Creating token using account:', testAccount.publicKey.toBase58());
  console.log('Mint public key:', mint.publicKey.toBase58());

  // Call createAndBuy method
  try {
    const createResults = await sdk.createAndBuy(
      testAccount,
      mint,
      tokenMetadata,
      BigInt(0.0001 * LAMPORTS_PER_SOL),
      SLIPPAGE_BASIS_POINTS,
      {
        unitLimit: 250000,
        unitPrice: 250000,
      }
    );

    if (createResults.success) {
      console.log('Success:', `https://pump.fun/${mint.publicKey.toBase58()}`);
      await printSPLBalance(sdk.connection, mint.publicKey, testAccount.publicKey);
    } else {
      console.error('Create and Buy failed');
      console.error('Error details:', createResults);
    }
  } catch (error) {
    console.error('Create and Buy operation threw an exception:');
    console.error('Error message:', error.message);
    
    // If it's a SendTransactionError, log the details
    if (error.logs) {
      console.error('Transaction logs:');
      error.logs.forEach((log, index) => {
        console.error(`Log ${index}:`, log);
      });
    }
    
    if (error.stack) {
      console.error('Error stack trace:');
      console.error(error.stack);
    }
  }
};

// Buy more tokens function
const buyTokens = async (sdk, testAccount, mint) => {
  try {
    const buyResults = await sdk.buy(
      testAccount,
      mint.publicKey,
      BigInt(0.0001 * LAMPORTS_PER_SOL),
      SLIPPAGE_BASIS_POINTS,
      {
        unitLimit: 250000,
        unitPrice: 250000,
      }
    );

    if (buyResults.success) {
      await printSPLBalance(sdk.connection, mint.publicKey, testAccount.publicKey);
      console.log('Bonding curve after buy', await sdk.getBondingCurveAccount(mint.publicKey));
    } else {
      console.error('Buy failed');
      console.error('Error details:', buyResults);
    }
  } catch (error) {
    console.error('Buy operation threw an exception:');
    console.error('Error message:', error.message);
    console.error('Error stack trace:', error.stack);
  }
};

// Sell tokens function
const sellTokens = async (sdk, testAccount, mint) => {
  try {
    const currentSPLBalance = await getSPLBalance(
      sdk.connection,
      mint.publicKey,
      testAccount.publicKey
    );
    console.log('Current SPL balance:', currentSPLBalance);

    if (currentSPLBalance) {
      const sellResults = await sdk.sell(
        testAccount,
        mint.publicKey,
        BigInt(currentSPLBalance * Math.pow(10, DEFAULT_DECIMALS)),
        SLIPPAGE_BASIS_POINTS,
        {
          unitLimit: 250000,
          unitPrice: 250000,
        }
      );

      if (sellResults.success) {
        await printSOLBalance(sdk.connection, testAccount.publicKey, 'Test Account keypair');
        await printSPLBalance(sdk.connection, mint.publicKey, testAccount.publicKey, 'After SPL sell all');
        console.log('Bonding curve after sell', await sdk.getBondingCurveAccount(mint.publicKey));
      } else {
        console.error('Sell failed');
        console.error('Error details:', sellResults);
      }
    }
  } catch (error) {
    console.error('Sell operation threw an exception:');
    console.error('Error message:', error.message);
    console.error('Error stack trace:', error.stack);
  }
};

// Main function
const main = async () => {
  try {
    console.log('Starting PumpFun SDK test');
    
    // Get provider and create SDK instance
    const provider = getProvider();
    const sdk = new PumpFunSDK(provider);
    const connection = provider.connection;

    // Get or create keypairs
    const testAccount = getOrCreateKeypair(KEYS_FOLDER, 'test-account');
    const mint = getOrCreateKeypair(KEYS_FOLDER, 'mint');

    // Print initial SOL balance
    await printSOLBalance(connection, testAccount.publicKey, 'Test Account keypair');

    // Get global account info
    const globalAccount = await sdk.getGlobalAccount();
    console.log('Global account:', globalAccount);

    // Check if account has SOL
    const currentSolBalance = await connection.getBalance(testAccount.publicKey);
    if (currentSolBalance === 0) {
      console.error('Please send some SOL to the test-account:', testAccount.publicKey.toBase58());
      console.error('You need at least 0.004 SOL for testing');
      return;
    }

    // Check if token already exists
    let bondingCurveAccount = await sdk.getBondingCurveAccount(mint.publicKey);
    if (!bondingCurveAccount) {
      console.log('Token does not exist, creating new token...');
      await createAndBuyToken(sdk, testAccount, mint);
      bondingCurveAccount = await sdk.getBondingCurveAccount(mint.publicKey);
    } else {
      console.log('Token already exists:', mint.publicKey.toBase58());
    }

    // If token exists, buy and sell tokens
    if (bondingCurveAccount) {
      console.log('Buying more tokens...');
      await buyTokens(sdk, testAccount, mint);
      
      console.log('Selling tokens...');
      await sellTokens(sdk, testAccount, mint);
    }
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('An error occurred:', error.message);
    console.error('Error stack trace:', error.stack);
  }
};

// Run the main function
main();
