// Pump.fun Token Creation using PumpPortal.fun API
// Author: Codeium
// Date: 2025-03-15

import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import fs from 'fs/promises';
import axios from 'axios';
import bs58 from 'bs58';
import FormData from 'form-data';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const IPFS_API_URL = 'https://pump.fun/api/ipfs';
const TRADE_API_URL = 'https://pumpportal.fun/api/trade';
const TRADE_LOCAL_API_URL = 'https://pumpportal.fun/api/trade-local';

// Configure logging
const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

const logError = (prefix, error) => {
  log(`${prefix} ERROR: ${error.message}`);
  if (error.response?.data) {
    log(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
  }
  if (error.stack) {
    log(`Stack trace: ${error.stack.split('\n')[0]}`);
  }
};

/**
 * Uploads token metadata and image to IPFS using Pump.fun API
 * @param {Object} metadata - Token metadata
 * @param {string} metadata.name - Token name
 * @param {string} metadata.symbol - Token symbol
 * @param {string} [metadata.description] - Token description
 * @param {string} [metadata.twitter] - Twitter link
 * @param {string} [metadata.telegram] - Telegram link
 * @param {string} [metadata.website] - Website link
 * @param {string} [metadata.showName] - Whether to show name
 * @param {string} [imagePath] - Path to token image
 * @returns {Promise<Object>} - IPFS metadata response
 */
async function uploadToIPFS(metadata, imagePath) {
  try {
    log('Uploading token metadata and image to IPFS...');
    
    const formData = new FormData();
    
    // Add metadata fields
    formData.append('name', metadata.name);
    formData.append('symbol', metadata.symbol);
    
    if (metadata.description) {
      formData.append('description', metadata.description);
    }
    
    if (metadata.twitter) {
      formData.append('twitter', metadata.twitter);
    }
    
    if (metadata.telegram) {
      formData.append('telegram', metadata.telegram);
    }
    
    if (metadata.website) {
      formData.append('website', metadata.website);
    }
    
    formData.append('showName', metadata.showName || 'true');
    
    // Add image if provided
    if (imagePath) {
      try {
        const imageBuffer = await fs.readFile(imagePath);
        formData.append('file', imageBuffer, { filename: path.basename(imagePath) });
        log(`Image added from: ${imagePath}`);
      } catch (fileError) {
        logError('FILE', fileError);
        throw new Error(`Failed to read image file: ${fileError.message}`);
      }
    } else {
      log('Warning: No image provided, token will be created without an image');
    }
    
    // Make API request to IPFS
    const response = await axios.post(IPFS_API_URL, formData, {
      headers: formData.getHeaders()
    });
    
    if (response.status !== 200) {
      throw new Error(`IPFS upload failed with status: ${response.status}`);
    }
    
    log('IPFS upload successful');
    log(`Metadata URI: ${response.data.metadataUri}`);
    
    return response.data;
  } catch (error) {
    logError('IPFS_UPLOAD', error);
    throw new Error(`Failed to upload to IPFS: ${error.message}`);
  }
}

/**
 * Creates a token using the Lightning Transaction method
 * @param {Object} options - Token creation options
 * @param {Object} options.metadata - Token metadata
 * @param {string} options.apiKey - PumpPortal API key
 * @param {string} options.imagePath - Path to token image
 * @param {number} options.amount - Amount of SOL for dev buy
 * @param {number} [options.slippage=10] - Slippage percentage
 * @param {number} [options.priorityFee=0.0005] - Priority fee in SOL
 * @returns {Promise<Object>} - Creation response
 */
async function createTokenLightning(options) {
  try {
    log('Creating token using Lightning Transaction method...');
    
    // Generate a new keypair for the token mint
    const mintKeypair = Keypair.generate();
    log(`Generated mint address: ${mintKeypair.publicKey.toString()}`);
    
    // Upload metadata and image to IPFS
    const ipfsResponse = await uploadToIPFS(options.metadata, options.imagePath);
    
    // Prepare token metadata
    const tokenMetadata = {
      name: ipfsResponse.metadata.name,
      symbol: ipfsResponse.metadata.symbol,
      uri: ipfsResponse.metadataUri
    };
    
    // Prepare request payload
    const payload = {
      action: 'create',
      tokenMetadata,
      mint: bs58.encode(mintKeypair.secretKey),
      denominatedInSol: 'true',
      amount: options.amount || 0.1,
      slippage: options.slippage || 10,
      priorityFee: options.priorityFee || 0.0005,
      pool: 'pump'
    };
    
    log('Sending create token request...');
    log(`Request payload: ${JSON.stringify({...payload, mint: '[REDACTED]'})}`);
    
    // Send request to create token
    const apiUrl = `${TRADE_API_URL}?api-key=${options.apiKey}`;
    const response = await axios.post(apiUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status !== 200) {
      throw new Error(`Token creation failed with status: ${response.status}`);
    }
    
    const result = response.data;
    log('Token creation successful!');
    log(`Transaction: https://solscan.io/tx/${result.signature}`);
    
    return {
      success: true,
      transaction: result.signature,
      token: mintKeypair.publicKey.toString(),
      tokenUrl: `https://pump.fun/${mintKeypair.publicKey.toString()}`
    };
  } catch (error) {
    logError('CREATE_TOKEN_LIGHTNING', error);
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

/**
 * Creates a token using the Local Transaction method
 * @param {Object} options - Token creation options
 * @param {Object} options.metadata - Token metadata
 * @param {string} options.privateKey - Wallet private key in base58
 * @param {string} options.imagePath - Path to token image
 * @param {number} options.amount - Amount of SOL for dev buy
 * @param {number} [options.slippage=10] - Slippage percentage
 * @param {number} [options.priorityFee=0.0005] - Priority fee in SOL
 * @returns {Promise<Object>} - Creation response
 */
async function createTokenLocal(options) {
  try {
    log('Creating token using Local Transaction method...');
    
    // Create wallet from private key
    const signerKeyPair = Keypair.fromSecretKey(bs58.decode(options.privateKey));
    log(`Using wallet: ${signerKeyPair.publicKey.toString()}`);
    
    // Generate a new keypair for the token mint
    const mintKeypair = Keypair.generate();
    log(`Generated mint address: ${mintKeypair.publicKey.toString()}`);
    
    // Upload metadata and image to IPFS
    const ipfsResponse = await uploadToIPFS(options.metadata, options.imagePath);
    
    // Prepare token metadata
    const tokenMetadata = {
      name: ipfsResponse.metadata.name,
      symbol: ipfsResponse.metadata.symbol,
      uri: ipfsResponse.metadataUri
    };
    
    // Prepare request payload
    const payload = {
      publicKey: signerKeyPair.publicKey.toString(),
      action: 'create',
      tokenMetadata,
      mint: mintKeypair.publicKey.toString(),
      denominatedInSol: 'true',
      amount: options.amount || 0.1,
      slippage: options.slippage || 10,
      priorityFee: options.priorityFee || 0.0005,
      pool: 'pump'
    };
    
    log('Sending local transaction request...');
    log(`Request payload: ${JSON.stringify({...payload})}`);
    
    // Send request to get transaction data
    const response = await axios.post(TRADE_LOCAL_API_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'arraybuffer'
    });
    
    if (response.status !== 200) {
      throw new Error(`Transaction creation failed with status: ${response.status}`);
    }
    
    // Setup Solana connection
    const connection = new Connection(process.env.HELIUS_RPC_URL, 'confirmed');
    
    // Deserialize and sign transaction
    const tx = VersionedTransaction.deserialize(new Uint8Array(response.data));
    tx.sign([mintKeypair, signerKeyPair]);
    
    // Send signed transaction
    log('Sending signed transaction to Solana network...');
    const signature = await connection.sendTransaction(tx);
    
    log('Token creation transaction submitted!');
    log(`Transaction: https://solscan.io/tx/${signature}`);
    
    return {
      success: true,
      transaction: signature,
      token: mintKeypair.publicKey.toString(),
      tokenUrl: `https://pump.fun/${mintKeypair.publicKey.toString()}`
    };
  } catch (error) {
    logError('CREATE_TOKEN_LOCAL', error);
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

export { uploadToIPFS, createTokenLightning, createTokenLocal };
