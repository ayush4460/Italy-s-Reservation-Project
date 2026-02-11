import redis from '../lib/redis';

/**
 * Shared utility to clear dashboard statistics cache for a specific restaurant.
 * This should be called whenever data that affects dashboard stats is modified 
 * (e.g., tables, reservations, slots).
 * 
 * @param restaurantId - The ID of the restaurant whose cache should be cleared.
 */
export const clearDashboardCache = async (restaurantId: number) => {
    try {
        const env = process.env.NODE_ENV || 'dev';
        // Matches all dashboard stats keys for this restaurant (v13 schema)
        const pattern = `${env}:dashboard:stats:v13:${restaurantId}:*`;
        
        let cursor = '0';
        let totalCleared = 0;

        do {
            // SCAN is safer than KEYS for production Redis
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            
            if (keys.length > 0) {
                await redis.del(...keys);
                totalCleared += keys.length;
            }
        } while (cursor !== '0');
        
        if (totalCleared > 0) {
            console.log(`[Cache] Cleared ${totalCleared} dashboard stats keys for restaurant ${restaurantId}`);
        }
    } catch (err) {
        // Silently fail but log warning, as cache clear shouldn't break the main flow
        console.warn("[Cache] Redis Clear Error (Dashboard Stats):", err);
    }
};
