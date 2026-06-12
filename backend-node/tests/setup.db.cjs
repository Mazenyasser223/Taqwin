/**
 * Vitest setup for DB integration tests — real Prisma (no mock).
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-ci';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.FEATURE_REALTIME_WS = 'true';
process.env.AI_INTERNAL_KEY = process.env.AI_INTERNAL_KEY || 'test-internal-key-min-16-chars';
delete process.env.MONGO_URI;
delete process.env.MONGODB_URI;
delete process.env.REDIS_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
