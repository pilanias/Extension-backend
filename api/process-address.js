// api/process-address.js
import { supabase, fetchAssetsForAddress, calculateValue } from './_utils.js';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { addressData, useSavedList } = request.body;
        const { address, username } = addressData;

        // Path 1: "Use Saved List" is ON.
        if (useSavedList) {
            const { data: existingWallet, error } = await supabase
                .from('wallets')
                .select('*')
                .eq('address', address)
                .single();

            if (existingWallet) {
                // Update username if it's different (e.g., 'N/A')
                if (existingWallet.username !== username) {
                    await supabase
                        .from('wallets')
                        .update({ username: username })
                        .eq('address', address);
                    existingWallet.username = username; // Update for return
                }
                // Return saved data
                return response.status(200).json({ status: 'skipped_displayed', data: existingWallet });
            }
        }

        // Path 2: "Use Saved List" is OFF, or the wallet wasn't found.
        // Fetch new data.
        const resultData = await fetchAssetsForAddress(address);
        
        if (resultData && !resultData.error) {
            const value = calculateValue(resultData.splTokens, resultData.nfts);
            const fullData = {
                address: address,
                username: username,
                spl_tokens: resultData.splTokens,
                nfts: resultData.nfts,
                value: value,
                last_checked: new Date().toISOString()
            };

            // Save to Supabase (Upsert = Update or Insert)
            const { error: upsertError } = await supabase
                .from('wallets')
                .upsert(fullData, { onConflict: 'address' });

            if (upsertError) {
                console.error('Supabase upsert error:', upsertError.message);
                throw upsertError;
            }
            
            // Rename keys for frontend (spl_tokens -> splTokens)
            const returnData = { ...fullData, splTokens: fullData.spl_tokens };
            
            return response.status(200).json({ status: 'processed_saved', data: returnData });
        } else {
            return response.status(500).json({ status: 'fetch_failed' });
        }

    } catch (error) {
        console.error('Server error:', error.message);
        return response.status(500).json({ status: 'error', error: error.message });
    }
}