// Solana blockchain interaction module
import { Connection, PublicKey, Keypair, Transaction, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import bs58 from 'bs58';
import { config } from './config.js';

// Initialize connection to Solana network
class SolanaAPI {
  constructor() {
    this.connection = null;
    // Force mainnet-beta network regardless of environment variable
    this.network = 'mainnet-beta';
    this.connected = false;
    this.lastConnectionCheck = 0;
    
    // Initialize connection immediately
    this.initConnection();
    
    // Set up connection health monitoring
    this.healthCheckInterval = setInterval(() => this.checkConnectionHealth(), 30000);
  }
  
  async initConnection() {
    const { network } = this;
    const endpoints = config.solana.endpoints[network] || config.solana.endpoints['devnet'];
    
    // Add more detailed logging
    console.error(`Initializing connection to Solana ${network} network`);
    console.error(`Environment variable SOLANA_NETWORK = ${process.env.SOLANA_NETWORK}`);
    console.error(`Config network = ${config.solana.network}`);
    console.error(`Using endpoints: ${JSON.stringify(endpoints)}`);
    
    // Try each endpoint until one works
    for (const endpoint of endpoints) {
      try {
        console.error(`Attempting to connect to ${network} via ${endpoint}`);
        this.connection = new Connection(endpoint, config.solana.commitment);
        
        // Test the connection
        await this.connection.getSlot();
        console.error(`Connected to Solana ${network} via ${endpoint}`);
        this.connected = true;
        this.lastConnectionCheck = Date.now();
        break;
      } catch (error) {
        console.error(`Failed to connect to ${endpoint}: ${error.message}`);
      }
    }
    
    if (!this.connected) {
      console.error(`Could not connect to any ${network} endpoints`);
    }
  }
  
  async checkConnectionHealth() {
    // Skip if last check was less than 10 seconds ago
    if (Date.now() - this.lastConnectionCheck < 10000) return;
    
    try {
      await this.connection.getSlot();
      this.connected = true;
    } catch (error) {
      console.error(`Connection check failed: ${error.message}`);
      this.connected = false;
      
      // Try to reconnect
      await this.initConnection();
    }
    
    this.lastConnectionCheck = Date.now();
  }
  
  /**
   * Get current network status information
   */
  async getNetworkStatus() {
    try {
      // First check if we're connected
      if (!this.connected) {
        console.error('Not connected to Solana network, attempting to reconnect');
        await this.initConnection();
        
        // If still not connected, return error state
        if (!this.connected) {
          return {
            network: this.network,
            connected: false,
            error: 'Failed to connect to Solana network'
          };
        }
      }
      
      // Get basic information with individual try-catch blocks
      let version = null;
      let slot = null;
      let blockTime = null;
      let health = 'unknown';
      let totalSupply = 0;
      let circulatingSupply = 0;
      
      try {
        version = await this.connection.getVersion();
      } catch (e) {
        console.error(`Could not get version: ${e.message}`);
      }
      
      try {
        slot = await this.connection.getSlot();
        if (slot) {
          try {
            blockTime = await this.connection.getBlockTime(slot);
          } catch (e) {
            console.error(`Could not get block time: ${e.message}`);
          }
        }
      } catch (e) {
        console.error(`Could not get slot: ${e.message}`);
      }
      
      try {
        health = await this.connection.getHealth();
      } catch (e) {
        console.error(`Could not get health: ${e.message}`);
        health = 'unknown';
      }
      
      // Get supply information
      try {
        const supplyInfo = await this.connection.getSupply();
        totalSupply = supplyInfo.value.total / LAMPORTS_PER_SOL;
        circulatingSupply = supplyInfo.value.circulating / LAMPORTS_PER_SOL;
      } catch (e) {
        console.error(`Could not get supply info: ${e.message}`);
      }
      
      return {
        network: this.network,
        connected: this.connected,
        version,
        currentSlot: slot,
        blockTime: blockTime ? new Date(blockTime * 1000).toISOString() : null,
        health,
        totalSupply,
        circulatingSupply
      };
    } catch (error) {
      console.error(`Error getting network status: ${error.message}`);
      
      // Return partial information instead of throwing
      return {
        network: this.network,
        connected: this.connected,
        error: `Failed to get complete network status: ${error.message}`
      };
    }
  }
  
  /**
   * Get SOL balance for a Solana address
   */
  async getBalance(address) {
    try {
      const pubkey = new PublicKey(address);
      const balance = await this.connection.getBalance(pubkey);
      
      return {
        address,
        balanceInLamports: balance,
        balanceInSol: balance / LAMPORTS_PER_SOL
      };
    } catch (error) {
      console.error(`Error getting balance for ${address}: ${error.message}`);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }
  
  /**
   * Get detailed account information
   */
  async getAccountInfo(address) {
    try {
      const pubkey = new PublicKey(address);
      const accountInfo = await this.connection.getAccountInfo(pubkey);
      
      if (!accountInfo) {
        return { exists: false, address };
      }
      
      return {
        exists: true,
        address,
        owner: accountInfo.owner.toString(),
        lamports: accountInfo.lamports,
        sol: accountInfo.lamports / LAMPORTS_PER_SOL,
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
   * Get recent transactions for an address
   */
  async getTransactions(address, limit = 10) {
    try {
      const pubkey = new PublicKey(address);
      const signatures = await this.connection.getSignaturesForAddress(pubkey, { limit });
      
      return signatures.map(sig => ({
        signature: sig.signature,
        slot: sig.slot,
        blockTime: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : null,
        err: sig.err,
        memo: sig.memo,
        confirmationStatus: sig.confirmationStatus
      }));
    } catch (error) {
      console.error(`Error getting transactions for ${address}: ${error.message}`);
      throw new Error(`Failed to get transactions: ${error.message}`);
    }
  }
  
  /**
   * Transfer SOL from one account to another
   */
  async transferSol(fromAddress, toAddress, amount, privateKey) {
    try {
      // Convert addresses to PublicKeys
      const fromPubkey = new PublicKey(fromAddress);
      const toPubkey = new PublicKey(toAddress);
      
      // Convert amount to lamports
      const lamports = amount * LAMPORTS_PER_SOL;
      
      // Decode private key and create keypair
      const secretKey = bs58.decode(privateKey);
      const fromKeypair = Keypair.fromSecretKey(secretKey);
      
      // Verify the keypair matches the fromAddress
      if (fromKeypair.publicKey.toString() !== fromAddress) {
        throw new Error('Private key does not match sender address');
      }
      
      // Create a transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports
        })
      );
      
      // Get the recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      // Sign and send the transaction
      transaction.sign(fromKeypair);
      const signature = await this.connection.sendRawTransaction(transaction.serialize());
      
      // Wait for confirmation
      await this.connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature
      });
      
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
  
  /**
   * Get token balance for a specific SPL token
   */
  async getTokenBalance(walletAddress, mintAddress) {
    try {
      const walletPubkey = new PublicKey(walletAddress);
      const mintPubkey = new PublicKey(mintAddress);
      
      // Find the associated token address
      const tokenAddress = await splToken.getAssociatedTokenAddress(
        mintPubkey,
        walletPubkey
      );
      
      try {
        // Get token account info
        const tokenInfo = await this.connection.getTokenAccountBalance(tokenAddress);
        
        return {
          walletAddress,
          tokenAddress: tokenAddress.toString(),
          mintAddress,
          balance: tokenInfo.value.uiAmount,
          decimals: tokenInfo.value.decimals
        };
      } catch (e) {
        // Token account might not exist
        return {
          walletAddress,
          tokenAddress: tokenAddress.toString(),
          mintAddress,
          balance: 0,
          decimals: 0,
          exists: false
        };
      }
    } catch (error) {
      console.error(`Error getting token balance: ${error.message}`);
      throw new Error(`Failed to get token balance: ${error.message}`);
    }
  }
  
  /**
   * Create a new Solana wallet
   */
  createWallet() {
    try {
      const keypair = Keypair.generate();
      return {
        publicKey: keypair.publicKey.toString(),
        privateKey: bs58.encode(keypair.secretKey)
      };
    } catch (error) {
      console.error(`Error creating wallet: ${error.message}`);
      throw new Error(`Failed to create wallet: ${error.message}`);
    }
  }
}

// Export a singleton instance
export const solanaAPI = new SolanaAPI();
