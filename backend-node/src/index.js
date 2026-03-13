/**
 * Taqwin backend — entry point.
 * Loads env, mounts app, starts server.
 */
require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Taqwin API running at http://localhost:${PORT} (with role + profile support)`);
});
