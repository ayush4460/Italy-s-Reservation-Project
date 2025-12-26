import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    // Don't crash if redis is down, just log
    reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
            // Only reconnect when the error is "READONLY"
            return true;
        }
        return false;
    }
});

redis.on('error', (err) => {
    // Suppress unhandled error events to prevent crashing if Redis is missing
    console.warn('Redis connection error (caching will be skipped):', err.message);
});

redis.on('connect', () => {
    console.log('Connected to Redis');
});

export default redis;
