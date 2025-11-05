// api/_utils.js
import { createClient } from '@supabase/supabase-js';

// --- Configuration ---
// Add these as Environment Variables in your Vercel project settings
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

const rpcUrls = [
    'https://endpoints.omniatech.io/v1/sol/mainnet/618af18c4f394ec389c280db568df58c',
    'https://rpc.shyft.to?api_key=oghkpINRhX40UIqd',
    'https://greed-solanam-54f5.mainnet.rpcpool.com/bc4d1328-18af-4dda-86ae-e70bdf5ed25e'
];
const dasApiKeys = [
    '64353f2f-5336-4fad-a046-d22ed08cba97',
    'dfb4dba6-5fcc-4b4d-9c9c-a240b05141f1'
];
let rpcIndex = 0;
let dasIndex = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- Fetching Logic (Moved from background.js) ---

// NOTE: Rate limiting is now per-worker-instance, which is less precise
// but still provides basic round-robin.
const fetchWithRetry = async (url, options, retries = 3, delay = 500) => {
    // ... (This function is identical to the one in your background.js) ...
    // ... (Copy and paste it here) ...
};

export async function fetchAssetsForAddress(walletAddress) {
    let splTokens = 0;
    let nfts = 0;
    let fetchError = false;

    // --- RPC Call: Get SPL Tokens ---
    try {
        rpcIndex = (rpcIndex + 1) % rpcUrls.length; // Simple round-robin
        const tokenAccountsResponse = await fetch(rpcUrls[rpcIndex], {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'getTokenAccountsByOwner', params: [walletAddress, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }] })
        }).then(res => res.json());

        splTokens = tokenAccountsResponse.result ? tokenAccountsResponse.result.value.length : 0;
        
        if (splTokens < 60) {
            return { splTokens, nfts, error: false }; // nfts is 0
        }
    } catch (error) {
        console.error(`Error fetching token accounts for ${walletAddress}: ${error.message}`);
        fetchError = true;
    }

    // --- DAS Call: Get NFTs (with API Key Switching) ---
    // ... (This logic is identical to your background.js) ...
    // ... (Copy and paste the DAS Call logic here) ...
    // ... (Make sure to use the dasApiKeys and dasIndex variables) ...
    
    dasIndex = (dasIndex + 1) % dasApiKeys.length; // Cycle key
    try {
        const dasResponse = await fetch(`https://mainnet.helius-rpc.com/?api-key=${dasApiKeys[dasIndex]}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 'rpc-id', method: 'getAssetsByOwner', params: { ownerAddress: walletAddress, page: 1, limit: 1000 } })
        }).then(res => res.json());
        
        if (dasResponse.result && Array.isArray(dasResponse.result.items)) {
            dasResponse.result.items.forEach(asset => {
                if (!asset.compression.compressed) nfts++;
            });
        }
    } catch (error) {
         console.warn(`DAS attempt failed: ${error.message}.`);
         fetchError = true;
    }

    if (fetchError && splTokens === 0 && nfts === 0) {
        return { error: true }; // Total failure
    }
    
    return { splTokens, nfts, error: false };
}

export function calculateValue(spl, nfts) {
    return Number((((spl || 0) + (nfts || 0)) * 0.00203928 * 190).toFixed(0));
}
