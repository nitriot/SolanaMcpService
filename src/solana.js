/**
 * Solana blockchain interaction module
 * Provides functions to interact with the Solana blockchain
 */

// Force console.log to stderr to avoid interfering with MCP protocol messages
const originalConsoleLog = console.log;
console.log = function() {
  // Redirect to stderr
  console.error.apply(console, arguments);
};

import * as web3 from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import bs58 from 'bs58';
import dotenv from 'dotenv';
dotenv.config();

// Default connection variables
let connection = null;
let network = 'devnet'; // Default network

/**
 * Initialize connection to Solana network
 * @param {string} networkName - Network to connect to (mainnet-beta, devnet, testnet)
 * @returns {Object} Solana connection handlers
 */
function initialize(networkName = process.env.SOLANA_NETWORK || 'devnet') {
  // Store network name for reference
  network = networkName || 'devnet';
  
  // Define available RPC endpoints for each network
  const rpcEndpoints = {
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
  };
  
  // Get endpoints for the selected network, or fallback to devnet
  const endpoints = rpcEndpoints[network] || rpcEndpoints['devnet'];
  
  // Try to connect using available endpoints
  let connected = false;
  let connectionError = null;
  
  // Try each endpoint until one works
  for (const endpoint of endpoints) {
    if (connected) break;
    
    try {
      connection = new web3.Connection(endpoint, 'confirmed');
      
      // Test the connection with a simple request
      connection.getSlot()
        .then(() => {
          console.error(`Connected to Solana ${network} via ${endpoint}`);
          connected = true;
        })
        .catch(error => {
          console.error(`Failed to connect to ${endpoint}: ${error.message}`);
          connectionError = error;
        });
    } catch (error) {
      console.error(`Error initializing connection to ${endpoint}: ${error.message}`);
      connectionError = error;
    }
  }
  
  if (!connected && connectionError) {
    console.error(`Could not connect to any ${network} endpoints: ${connectionError.message}`);
  }
  
  /**
   * Get the current status of the Solana network
   * @returns {Promise<Object>} Network status information
   */
  async function getNetworkStatus() {
    try {
      const version = await connection.getVersion();
      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const supply = await connection.getSupply();
      
      return {
        network,
        version,
        currentSlot: slot,
        blockTime: new Date(blockTime * 1000).toISOString(),
        totalSupply: supply.value.total / web3.LAMPORTS_PER_SOL,
        circulatingSupply: supply.value.circulating / web3.LAMPORTS_PER_SOL
      };
    } catch (error) {
      console.error(`Error getting network status: ${error.message}`);
      throw new Error(`Failed to get network status: ${error.message}`);
    }
  }
  
  /**
   * Get SOL balance for a Solana address
   * @param {string} address - Solana account address
   * @returns {Promise<number>} Account balance in SOL
   */
  async function getBalance(address) {
    try {
      const pubkey = new web3.PublicKey(address);
      const balance = await connection.getBalance(pubkey);
      return {
        address,
        balanceInLamports: balance,
        balanceInSol: balance / web3.LAMPORTS_PER_SOL
      };
    } catch (error) {
      console.error(`Error getting balance for ${address}: ${error.message}`);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }
  
  /**
   * Get recent transactions for a Solana address
   * @param {string} address - Solana account address
   * @param {number} limit - Maximum number of transactions to return
   * @returns {Promise<Array>} Array of recent transactions
   */
  async function getTransactions(address, limit = 10) {
    try {
      const pubkey = new web3.PublicKey(address);
      const transactions = await connection.getSignaturesForAddress(pubkey, {
        limit: limit
      });
      
      return transactions.map(tx => ({
        signature: tx.signature,
        slot: tx.slot,
        blockTime: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
        err: tx.err,
        memo: tx.memo,
        confirmationStatus: tx.confirmationStatus
      }));
    } catch (error) {
      console.error(`Error getting transactions for ${address}: ${error.message}`);
      throw new Error(`Failed to get transactions: ${error.message}`);
    }
  }
  
  /**
   * Get detailed account information
   * @param {string} address - Solana account address
   * @returns {Promise<Object>} Account information
   */
  async function getAccountInfo(address) {
    try {
      const pubkey = new web3.PublicKey(address);
      const accountInfo = await connection.getAccountInfo(pubkey);
      
      if (!accountInfo) {
        return { exists: false, address };
      }
      
      return {
        exists: true,
        address,
        owner: accountInfo.owner.toString(),
        lamports: accountInfo.lamports,
        sol: accountInfo.lamports / web3.LAMPORTS_PER_SOL,
        executable: accountInfo.executable,
        rentEpoch: accountInfo.rentEpoch,
        dataSize: accountInfo.data.length
      };
    } catch (error) {
      console.error(`Error getting account info for ${address}: ${error.message}`);
      throw new Error(`Failed to get account info: ${error.message}`);
    }
  }
  
  /**
   * Transfer SOL from one account to another
   * @param {string} fromAddress - Sender address
   * @param {string} toAddress - Recipient address
   * @param {number} amount - Amount in SOL to transfer
   * @param {string} privateKey - Base58 encoded private key of sender
   * @returns {Promise<Object>} Transaction details
   */
  async function transferSol(fromAddress, toAddress, amount, privateKey) {
    try {
      // Convert addresses to PublicKeys
      const fromPubkey = new web3.PublicKey(fromAddress);
      const toPubkey = new web3.PublicKey(toAddress);
      
      // Convert amount to lamports
      const lamports = amount * web3.LAMPORTS_PER_SOL;
      
      // Decode private key and create keypair
      const secretKey = bs58.decode(privateKey);
      const fromKeypair = web3.Keypair.fromSecretKey(secretKey);
      
      // Verify the keypair matches the fromAddress
      if (fromKeypair.publicKey.toString() !== fromAddress) {
        throw new Error('Private key does not match sender address');
      }
      
      // Create a transfer transaction
      const transaction = new web3.Transaction().add(
        web3.SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports
        })
      );
      
      // Get the recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      // Sign and send the transaction
      const signature = await web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [fromKeypair]
      );
      
      return {
        success: true,
        signature,
        from: fromAddress,
        to: toAddress,
        amount,
        lamports
      };
    } catch (error) {
      console.error(`Error transferring SOL: ${error.message}`);
      throw new Error(`Failed to transfer SOL: ${error.message}`);
    }
  }
  
  // Return the API
  return {
    getNetworkStatus,
    getBalance,
    getTransactions,
    getAccountInfo,
    transferSol,
    connection,
    network
  };
}

export { initialize };
