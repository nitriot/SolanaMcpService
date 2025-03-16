/**
 * Pump.fun Integration for Solana MCP Server
 * Provides token creation functionality using PumpPortal.fun API
 */

// Import required libraries
import axios from 'axios';
import { Connection, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import FormData from 'form-data';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import https from 'https'; // Import https for SSL Agent

// Load environment variables
dotenv.config();

// Fix for ES modules: Define __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug current environment
console.error('Environment check:');
console.error(`PUMPFUN_PRIVATE_KEY exists: ${process.env.PUMPFUN_PRIVATE_KEY ? 'YES' : 'NO'}`);
console.error(`PUMPFUN_PRIVATE_KEY length: ${process.env.PUMPFUN_PRIVATE_KEY ? process.env.PUMPFUN_PRIVATE_KEY.length : 0}`);
console.error(`HELIUS_RPC_URL exists: ${process.env.HELIUS_RPC_URL ? 'YES' : 'NO'}`);

// Constants
const IPFS_API_URL = 'https://pump.fun/api/ipfs';
const TRADE_LOCAL_API_URL = 'https://pumpportal.fun/api/trade-local';

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
async function uploadToIPFS(metadata, imagePath = null) {
  try {
    console.error('Uploading token metadata and image to IPFS...');
    
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
    
    // Add image if provided - EXACTLY LIKE THE WORKING TEST SCRIPT
    if (imagePath) {
      try {
        console.error(`Reading image from: ${imagePath}`);
        const imageBuffer = await fs.readFile(imagePath);
        formData.append('file', imageBuffer, { filename: path.basename(imagePath) });
        console.error(`Image added from: ${imagePath}`);
      } catch (fileError) {
        console.error(`Failed to read image file: ${fileError.message}`);
        throw new Error(`Failed to read image file: ${fileError.message}`);
      }
    } else {
      console.error('Warning: No image provided, token will be created without an image');
    }
    
    // Make API request to IPFS - with SSL verification disabled for testing
    console.error(`Sending request to IPFS API: ${IPFS_API_URL}`);
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const response = await axios.post(IPFS_API_URL, formData, {
      headers: formData.getHeaders(),
      httpsAgent: httpsAgent, // Disable SSL certificate verification
    });
    
    if (response.status !== 200) {
      throw new Error(`IPFS upload failed with status: ${response.status}`);
    }
    
    console.error('IPFS upload successful');
    console.error(`Metadata URI: ${response.data.metadataUri}`);
    
    return response.data;
  } catch (error) {
    console.error(`IPFS_UPLOAD ERROR: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    throw new Error(`Failed to upload to IPFS: ${error.message}`);
  }
}

/**
 * Creates a token using PumpPortal API
 * @param {Object} options - Token creation options
 * @param {Object} options.metadata - Token metadata
 * @param {string} options.privateKey - Wallet private key in base58
 * @param {string} options.imagePath - Path to token image
 * @param {number} options.amount - Amount of SOL for dev buy
 * @param {number} [options.slippage=10] - Slippage percentage
 * @param {number} [options.priorityFee=0.0005] - Priority fee in SOL
 * @param {string} [options.rpcUrl] - Custom RPC URL
 * @returns {Promise<Object>} - Creation response
 */
async function createToken(options) {
  try {
    console.error('Creating token using Local Transaction method...');
    
    // Create wallet from private key
    const signerKeyPair = Keypair.fromSecretKey(bs58.decode(options.privateKey));
    console.error(`Using wallet: ${signerKeyPair.publicKey.toString()}`);
    
    // Generate a new keypair for the token mint
    const mintKeypair = Keypair.generate();
    console.error(`Generated mint address: ${mintKeypair.publicKey.toString()}`);
    
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
    
    console.error('Sending local transaction request...');
    console.error(`Request payload: ${JSON.stringify({...payload})}`);
    
    // Send request to get transaction data
    const response = await axios.post(TRADE_LOCAL_API_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'arraybuffer'
    });
    
    if (response.status !== 200) {
      throw new Error(`Transaction creation failed with status: ${response.status}`);
    }
    
    // Setup Solana connection
    const rpcUrl = options.rpcUrl || process.env.HELIUS_RPC_URL;
    console.error(`Using RPC URL: ${rpcUrl}`);
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Deserialize and sign transaction
    const tx = VersionedTransaction.deserialize(new Uint8Array(response.data));
    tx.sign([mintKeypair, signerKeyPair]);
    
    // Send signed transaction
    console.error('Sending signed transaction to Solana network...');
    const signature = await connection.sendTransaction(tx);
    
    console.error('Token creation transaction submitted!');
    console.error(`Transaction: https://solscan.io/tx/${signature}`);
    
    return {
      success: true,
      transaction: signature,
      token: mintKeypair.publicKey.toString(),
      tokenUrl: `https://pump.fun/${mintKeypair.publicKey.toString()}`
    };
  } catch (error) {
    console.error(`CREATE_TOKEN_ERROR: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

/**
 * MCP-compatible function to create a Pump.fun token
 * @param {Object} params - Parameters for token creation
 * @returns {Promise<Object>} - Creation response
 */
async function createPumpFunToken(params) {
  try {
    // Debug environment variables
    console.error('Environment check in createPumpFunToken:');
    console.error(`PUMPFUN_PRIVATE_KEY exists: ${process.env.PUMPFUN_PRIVATE_KEY ? 'YES' : 'NO'}`);
    console.error(`PUMPFUN_PRIVATE_KEY length: ${process.env.PUMPFUN_PRIVATE_KEY ? process.env.PUMPFUN_PRIVATE_KEY.length : 0}`);
    console.error(`HELIUS_RPC_URL exists: ${process.env.HELIUS_RPC_URL ? 'YES' : 'NO'}`);
    
    // Validate required parameters
    if (!params.name || !params.symbol) {
      throw new Error('Missing required parameters: name and symbol must be provided');
    }
    
    // Use provided privateKey or fall back to environment variable or hardcoded key (for testing)
    // Direct hardcoded key - ONLY FOR TESTING
    const hardcodedKey = 'your private key';
    const privateKey = params.privateKey || process.env.PUMPFUN_PRIVATE_KEY || hardcodedKey;
    console.error(`Final privateKey check: ${privateKey ? 'Found key, length: ' + privateKey.length : 'No key found'}`);
    
    if (!privateKey) {
      throw new Error('No private key provided and PUMPFUN_PRIVATE_KEY not found in environment');
    }
    
    // SIMPLIFIED IMAGE PATH HANDLING - EXACT SAME WAY AS TEST SCRIPT
    // Always use a fixed path to a known working image
    const DEFAULT_IMAGE_PATH = path.resolve(__dirname, '..', 'example/basic/random.png');
    console.error(`Using default image path: ${DEFAULT_IMAGE_PATH}`);
    
    // Call the token creation function with parameters
    const result = await createToken({
      metadata: {
        name: params.name,
        symbol: params.symbol,
        description: params.description || `Created via Solana MCP on ${new Date().toISOString()}`,
        website: params.website || '',
        twitter: params.twitter || '',
        telegram: params.telegram || '',
        showName: 'true'
      },
      privateKey,
      imagePath: DEFAULT_IMAGE_PATH, // Always use the default image path
      amount: parseFloat(params.amount) || 0.1,
      slippage: parseInt(params.slippage) || 10,
      priorityFee: parseFloat(params.priorityFee) || 0.0005,
      rpcUrl: params.rpcUrl || process.env.HELIUS_RPC_URL || your rpc url
    });
    
    return result;
  } catch (error) {
    console.error(`MCP TOKEN CREATION ERROR: ${error.message}`);
    throw error;
  }
}

export { createPumpFunToken };
