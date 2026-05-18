/** Prisma stub for smoke tests — no real database connection. */
const fakeModel = () =>
  new Proxy(
    {},
    {
      get: () => async () => [],
    },
  );

const prisma = new Proxy(
  {
    $queryRaw: async () => [{ ok: 1 }],
    $disconnect: async () => undefined,
    $transaction: async (cb) => (typeof cb === 'function' ? cb({}) : Promise.all(cb)),
  },
  { get: () => fakeModel() },
);

module.exports = { prisma };
