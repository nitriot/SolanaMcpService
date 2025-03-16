import fs from 'fs';
import path from 'path';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';

/**
 * Get or create a keypair from a file
 */
export function getOrCreateKeypair(keysFolder, name) {
  const keypairFile = path.resolve(keysFolder, `${name}.json`);
  
  if (!fs.existsSync(keysFolder)) {
    fs.mkdirSync(keysFolder, { recursive: true });
    console.log(`Created keys folder: ${keysFolder}`);
  }
  
  if (fs.existsSync(keypairFile)) {
    const keypairString = fs.readFileSync(keypairFile, 'utf-8');
    const keypairData = JSON.parse(keypairString);
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  }
  
  const keypair = Keypair.generate();
  const keypairData = Array.from(keypair.secretKey);
  fs.writeFileSync(keypairFile, JSON.stringify(keypairData));
  console.log(`Created and saved keypair: ${name} (${keypair.publicKey.toBase58()})`);
  
  return keypair;
}

/**
 * Print SOL balance of an account
 */
export async function printSOLBalance(connection, publicKey, label = "") {
  const balance = await connection.getBalance(publicKey);
  console.log(`SOL Balance for ${label || publicKey.toBase58()}: ${balance / LAMPORTS_PER_SOL} SOL`);
  return balance;
}

/**
 * Get SPL token balance
 */
export async function getSPLBalance(connection, mint, owner) {
  try {
    const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });
    
    if (accounts && accounts.value && accounts.value.length > 0) {
      const tokenBalance = accounts.value[0].account.data.parsed.info.tokenAmount;
      return tokenBalance.uiAmount;
    }
    
    return 0;
  } catch (error) {
    console.error('Error getting SPL balance:', error.message);
    return 0;
  }
}

/**
 * Print SPL token balance
 */
export async function printSPLBalance(connection, mint, owner, label = "") {
  const balance = await getSPLBalance(connection, mint, owner);
  console.log(`Token Balance for ${label || owner.toBase58()}: ${balance} tokens`);
  return balance;
}
