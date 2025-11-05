// api/get-wallets.js
import { supabase } from './_utils.js';

const ITEMS_PER_PAGE = 50;

export default async function handler(request, response) {
    try {
        const { 
            page = 1, 
            sortKey = 'value', 
            sortDir = 'desc' 
        } = request.query;

        const pageNum = parseInt(page, 10) || 1;
        const offset = (pageNum - 1) * ITEMS_PER_PAGE;
        
        // Sanitize sortKey to match DB columns
        const validSortKeys = ['address', 'username', 'value', 'spl_tokens', 'nfts', 'last_checked'];
        const dbSortKey = validSortKeys.includes(sortKey) ? sortKey : 'value';

        const dbSortDir = sortDir === 'asc' ? 'asc' : 'desc';

        // Query for the data with pagination
        let query = supabase
            .from('wallets')
            .select('*', { count: 'exact' }) // Get total count
            .order(dbSortKey, { ascending: dbSortDir === 'asc' })
            .range(offset, offset + ITEMS_PER_PAGE - 1);

        const { data, error, count } = await query;

        if (error) {
            throw error;
        }

        // Rename keys for frontend (spl_tokens -> splTokens)
        const formattedData = data.map(item => ({
            ...item,
            splTokens: item.spl_tokens,
            nfts: item.nfts,
            lastChecked: item.last_checked
        }));

        return response.status(200).json({
            data: formattedData,
            totalCount: count,
            page: pageNum,
            itemsPerPage: ITEMS_PER_PAGE
        });

    } catch (error) {
        console.error('Error fetching wallets:', error.message);
        return response.status(500).json({ error: 'Failed to fetch wallets' });
    }
}