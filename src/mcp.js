/**
 * Solana MCP (Model Context Protocol) integration
 * This module provides specific handlers for AI models to interact with Solana blockchain
 */

const { PublicKey, Transaction, SystemProgram, Keypair } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const bs58 = require('bs58');

/**
 * Initialize MCP tools for Solana interactions
 * @param {Object} solanaConnection - Solana connection object with utilities
 * @returns {Object} Object containing MCP tool handlers
 */
function initializeMcpTools(solanaConnection) {
  const { connection, getBalance, getTransactions, getNetworkStatus } = solanaConnection;
  
  return {
    /**
     * Process request from MCP
     * @param {Object} request - Request object from MCP
     * @returns {Promise<Object>} Response object
     */
    async processRequest(request) {
      const { action, parameters } = request;
      
      if (!action) {
        throw new Error('Missing action parameter');
      }
      
      switch (action) {
        case 'getNetworkStatus':
          return await getNetworkStatus();
          
        case 'getBalance':
          if (!parameters?.address) {
            throw new Error('Missing address parameter');
          }
          return {
            action,
            address: parameters.address,
            balance: await getBalance(parameters.address)
          };
          
        case 'getTransactions':
          if (!parameters?.address) {
            throw new Error('Missing address parameter');
          }
          return {
            action,
            address: parameters.address,
            transactions: await getTransactions(parameters.address, parameters.limit || 10)
          };
          
        case 'createWallet':
          const keypair = Keypair.generate();
          return {
            action,
            publicKey: keypair.publicKey.toString(),
            privateKey: bs58.encode(keypair.secretKey)
          };
          
        case 'transferSol':
          if (!parameters?.from || !parameters?.to || !parameters?.amount || !parameters?.privateKey) {
            throw new Error('Missing required parameters for transfer');
          }
          
          try {
            // Convert amount to lamports (SOL * 10^9)
            const lamports = Math.round(parseFloat(parameters.amount) * 1000000000);
            
            // Create keypair from private key
            const fromKeypair = Keypair.fromSecretKey(bs58.decode(parameters.privateKey));
            const toPublicKey = new PublicKey(parameters.to);
            
            // Create transaction
            const transaction = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: fromKeypair.publicKey,
                toPubkey: toPublicKey,
                lamports
              })
            );
            
            // Send and confirm transaction
            const signature = await connection.sendTransaction(transaction, [fromKeypair]);
            await connection.confirmTransaction(signature);
            
            return {
              action,
              success: true,
              signature,
              message: `Transferred ${parameters.amount} SOL from ${fromKeypair.publicKey.toString()} to ${parameters.to}`
            };
          } catch (error) {
            throw new Error(`Transfer failed: ${error.message}`);
          }
          
        case 'getAccountInfo':
          if (!parameters?.address) {
            throw new Error('Missing address parameter');
          }
          
          try {
            const publicKey = new PublicKey(parameters.address);
            const accountInfo = await connection.getAccountInfo(publicKey);
            const balance = await getBalance(parameters.address);
            
            return {
              action,
              address: parameters.address,
              balance,
              exists: accountInfo !== null,
              executable: accountInfo ? accountInfo.executable : null,
              owner: accountInfo ? accountInfo.owner.toString() : null,
              rentEpoch: accountInfo ? accountInfo.rentEpoch : null,
              dataSize: accountInfo ? accountInfo.data.length : null
            };
          } catch (error) {
            throw new Error(`Failed to get account info: ${error.message}`);
          }
          
        // Add handler for SPL tokens
        case 'getTokenAccounts':
          if (!parameters?.address) {
            throw new Error('Missing address parameter');
          }
          
          try {
            const publicKey = new PublicKey(parameters.address);
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
              publicKey,
              { programId: TOKEN_PROGRAM_ID }
            );
            
            return {
              action,
              address: parameters.address,
              tokenAccounts: tokenAccounts.value.map(account => ({
                pubkey: account.pubkey.toString(),
                mint: account.account.data.parsed.info.mint,
                owner: account.account.data.parsed.info.owner,
                amount: account.account.data.parsed.info.tokenAmount.uiAmount,
                decimals: account.account.data.parsed.info.tokenAmount.decimals
              }))
            };
          } catch (error) {
            throw new Error(`Failed to get token accounts: ${error.message}`);
          }
          
        default:
          throw new Error(`Unsupported action: ${action}`);
      }
    },
    
    /**
     * Handle WebSocket messages for MCP
     * @param {WebSocket} ws - WebSocket client
     * @param {Object} message - Parsed message object
     * @returns {Promise<void>}
     */
    async handleWebSocketMessage(ws, message) {
      try {
        const response = await this.processRequest(message);
        ws.send(JSON.stringify({
          type: 'response',
          requestId: message.requestId,
          data: response
        }));
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          requestId: message.requestId,
          error: error.message
        }));
      }
    }
  };
}

module.exports = { initializeMcpTools };
