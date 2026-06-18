/** Prisma stub for smoke tests — no real database connection. */
const fakeModel = () =>
  new Proxy(
    {},
    {
      get: () => async () => [],
    },
  );

const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';
const MISSING_USER_ID = '00000000-0000-4000-8000-000000000000';

const prisma = new Proxy(
  {
    $queryRaw: async (strings) => {
      const sql = Array.isArray(strings) ? strings.join('?') : String(strings);
      if (sql.includes('pg_extension')) {
        return [{ extname: 'vector', extversion: '0.8.0' }];
      }
      if (sql.includes('knowledge_chunks')) {
        return [{ chunks: 0, embedded: 0 }];
      }
      return [{ ok: 1 }];
    },
    $disconnect: async () => undefined,
    $transaction: async (cb) => (typeof cb === 'function' ? cb({}) : Promise.all(cb)),
    user: {
      findUnique: async ({ where }) => {
        if (where?.id === MISSING_USER_ID) return null;
        if (where?.telegramChatId != null) return null;
        return {
          id: where?.id || TEST_USER_ID,
          email: 'test@test.local',
          role: 'athlete',
          tokenVersion: 0,
        };
      },
    },
    aiToolExecution: {
      create: async ({ data }) => ({ id: 'exec-test-1', ...data }),
    },
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      return fakeModel();
    },
  },
);

module.exports = { prisma };
