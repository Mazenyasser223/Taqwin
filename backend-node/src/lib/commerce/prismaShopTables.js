/**
 * Detect Prisma errors when shop marketing tables are not migrated yet.
 */
function isMissingShopTableError(err) {
  if (!err) return false;
  if (err.code === 'P2021') return true;
  return /does not exist in the current database/i.test(String(err.message || ''));
}

module.exports = { isMissingShopTableError };
