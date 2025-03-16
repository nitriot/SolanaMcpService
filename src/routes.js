/**
 * API routes for Solana MCP service
 */

const { PublicKey, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

/**
 * Set up API routes for Solana MCP service
 * @param {Express} app - Express application
 * @param {Object} solanaConnection - Solana connection utilities
 */
function setupRoutes(app, solanaConnection) {
  const { getBalance, getTransactions, getNetworkStatus, transferSol, getAccountInfo } = solanaConnection;

  // Health check route
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
  });

  // Get Solana network status
  app.get('/api/network', async (req, res) => {
    try {
      const networkStatus = await getNetworkStatus();
      res.json(networkStatus);
    } catch (error) {
      console.error('Error getting network status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get SOL balance for an address
  app.get('/api/balance/:address', async (req, res) => {
    try {
      const { address } = req.params;
      
      // Validate Solana address
      try {
        new PublicKey(address);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid Solana address' });
      }
      
      const balance = await getBalance(address);
      res.json({ address, balance });
    } catch (error) {
      console.error('Error getting balance:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get recent transactions for an address
  app.get('/api/transactions/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      
      // Validate Solana address
      try {
        new PublicKey(address);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid Solana address' });
      }
      
      const transactions = await getTransactions(address, limit);
      res.json({ address, transactions });
    } catch (error) {
      console.error('Error getting transactions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new Solana wallet
  app.post('/api/wallet/create', (req, res) => {
    try {
      const keypair = Keypair.generate();
      res.json({
        publicKey: keypair.publicKey.toString(),
        privateKey: bs58.encode(keypair.secretKey)
      });
    } catch (error) {
      console.error('Error creating wallet:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Transfer SOL between addresses
  app.post('/api/transfer', async (req, res) => {
    try {
      const { from, to, amount, privateKey } = req.body;
      
      if (!from || !to || !amount || !privateKey) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Validate addresses
      try {
        new PublicKey(from);
        new PublicKey(to);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid Solana address' });
      }
      
      // Validate amount
      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      
      const result = await transferSol(from, to, parseFloat(amount), privateKey);
      res.json(result);
    } catch (error) {
      console.error('Error transferring SOL:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get account information
  app.get('/api/account/:address', async (req, res) => {
    try {
      const { address } = req.params;
      
      // Validate Solana address
      try {
        new PublicKey(address);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid Solana address' });
      }
      
      const accountInfo = await getAccountInfo(address);
      res.json({ address, ...accountInfo });
    } catch (error) {
      console.error('Error getting account info:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // MCP execute endpoint
  app.post('/api/mcp/execute', async (req, res) => {
    try {
      const { initializeMcpTools } = require('./mcp');
      const mcpTools = initializeMcpTools(solanaConnection);
      
      const result = await mcpTools.processRequest(req.body);
      res.json(result);
    } catch (error) {
      console.error('Error executing MCP command:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = { setupRoutes };
