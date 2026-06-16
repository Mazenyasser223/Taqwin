require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const u = await p.user.findUnique({ where: { email: 't2t0test@gmail.com' } });
  const gym = await p.gym.findFirst({ where: { ownerId: u.id } });
  const token = jwt.sign({ sub: u.id, role: u.role, email: u.email }, process.env.JWT_SECRET);
  const headers = { Authorization: `Bearer ${token}` };

  const dash = await fetch('http://127.0.0.1:4002/api/dashboard/gym', { headers });
  console.log('dashboard/gym', dash.status, (await dash.text()).slice(0, 600));

  const staff = await fetch(`http://127.0.0.1:4002/api/gyms/${gym.id}/staff`, { headers });
  console.log('staff', staff.status, (await staff.text()).slice(0, 300));
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
