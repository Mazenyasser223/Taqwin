/**
 * Full gym class session flow:
 * book → list bookings → dashboard stats (booked)
 * mark attended → stats (attended)
 * expire past class → remaining booked → no_show
 *
 * Run while backend is on PORT (default 4002).
 */
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function api(path, token, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json };
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  console.log('=== Gym class session full flow ===\n');

  const gymOwner = await prisma.user.findFirst({
    where: { role: 'gym' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  assert(gymOwner, 'No gym owner in DB');
  const gym = await prisma.gym.findFirst({ where: { ownerId: gymOwner.id } });
  assert(gym, 'No gym for owner');

  let trainer = await prisma.gymStaff.findFirst({
    where: { gymId: gym.id, role: 'trainer', isActive: true },
  });
  if (!trainer) {
    trainer = await prisma.gymStaff.create({
      data: { gymId: gym.id, fullName: 'Flow Test Trainer', role: 'trainer', baseSalary: 4000 },
    });
  }

  const token = jwt.sign({ sub: gymOwner.id, role: 'gym' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const today = new Date();
  const sessionDate = new Date(`${localDateKey(today)}T12:00:00.000Z`);

  const className = `Flow Test ${Date.now()}`;
  let gymClass = await prisma.gymClass.create({
    data: {
      gymId: gym.id,
      name: className,
      price: 200,
      currency: 'EGP',
      staffId: trainer.id,
      sessionDate,
      dayOfWeek: sessionDate.getUTCDay(),
      startTime: '06:00',
      endTime: '23:59',
      isActive: true,
    },
  });

  const bookingIds = [];
  const emails = [`flow-a-${Date.now()}@test.local`, `flow-b-${Date.now()}@test.local`];

  try {
    // 1) Today classes endpoint
    const todayRes = await api(`/api/gyms/${gym.id}/classes/today`, token);
    assert(todayRes.res.ok, `GET /classes/today failed ${todayRes.res.status}`);
    assert(
      todayRes.json.some((c) => c.id === gymClass.id),
      'Created class should appear in /classes/today',
    );
    console.log('✓ GET /classes/today includes today class');

    // 2) Book two members
    for (let i = 0; i < emails.length; i++) {
      const { res, json } = await api(`/api/gyms/${gym.id}/classes/${gymClass.id}/bookings`, token, {
        method: 'POST',
        body: JSON.stringify({
          firstName: i === 0 ? 'Ahmed' : 'Sara',
          lastName: 'FlowTest',
          email: emails[i],
          paymentMethod: 'cash',
        }),
      });
      assert(res.ok, `POST booking ${i + 1} failed ${res.status} ${JSON.stringify(json)}`);
      assert(json.booking?.status === 'booked', 'New booking should be booked');
      bookingIds.push(json.booking.id);
    }
    console.log('✓ POST 2 bookings (status=booked)');

    // 3) List bookings
    const listRes = await api(`/api/gyms/${gym.id}/classes/${gymClass.id}/bookings`, token);
    assert(listRes.res.ok, `GET bookings failed ${listRes.res.status}`);
    assert(listRes.json.bookings?.length === 2, `Expected 2 bookings, got ${listRes.json.bookings?.length}`);
    console.log('✓ GET /classes/:id/bookings returns roster');

    // 4) Dashboard stats — booked counts
    const dash1 = await api('/api/dashboard/gym', token);
    assert(dash1.res.ok, `dashboard/gym failed ${dash1.res.status}`);
    const stats1 = dash1.json.classSessionStats;
    assert(stats1, 'classSessionStats missing');
    const row1 = stats1.sessions.find((s) => s.classId === gymClass.id);
    assert(row1, 'Class missing from dashboard sessions');
    assert(row1.booked === 2, `Expected booked=2, got ${row1.booked}`);
    assert(row1.attended === 0, `Expected attended=0, got ${row1.attended}`);
    assert(stats1.totalBooked >= 2, 'totalBooked should include new bookings');
    console.log('✓ Dashboard stats show booked=2, attended=0');

    // 5) Mark first booking attended
    const attendRes = await api(
      `/api/gyms/${gym.id}/classes/${gymClass.id}/bookings/${bookingIds[0]}`,
      token,
      { method: 'PATCH', body: JSON.stringify({ status: 'attended' }) },
    );
    assert(attendRes.res.ok, `PATCH attended failed ${attendRes.res.status} ${JSON.stringify(attendRes.json)}`);
    assert(attendRes.json.status === 'attended', 'Booking should be attended');
    console.log('✓ PATCH mark attended');

    // 6) Dashboard stats after attendance
    const dash2 = await api('/api/dashboard/gym', token);
    const row2 = dash2.json.classSessionStats.sessions.find((s) => s.classId === gymClass.id);
    assert(row2.booked === 1, `After attend: booked should be 1, got ${row2.booked}`);
    assert(row2.attended === 1, `After attend: attended should be 1, got ${row2.attended}`);
    console.log('✓ Dashboard stats show booked=1, attended=1');

    // 7) List bookings reflects status
    const list2 = await api(`/api/gyms/${gym.id}/classes/${gymClass.id}/bookings`, token);
    const statuses = list2.json.bookings.map((b) => b.status).sort();
    assert(statuses.includes('attended') && statuses.includes('booked'), `Statuses: ${statuses.join(',')}`);
    console.log('✓ Booking list shows mixed statuses');

    // 8) Simulate class ended — expirePastClasses via stats endpoint
    await prisma.gymClass.update({
      where: { id: gymClass.id },
      data: { endTime: '00:01', startTime: '00:00' },
    });
    // session ended yesterday relative to "now" by setting sessionDate to yesterday
    const yesterday = new Date(sessionDate);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    await prisma.gymClass.update({
      where: { id: gymClass.id },
      data: { sessionDate: yesterday },
    });

    const statsTrigger = await api(`/api/gyms/${gym.id}/classes/stats`, token);
    assert(statsTrigger.res.ok, `GET /classes/stats failed ${statsTrigger.res.status}`);

    const remaining = await prisma.gymClassBooking.findMany({
      where: { id: { in: bookingIds } },
      select: { id: true, status: true },
    });
    const byId = Object.fromEntries(remaining.map((b) => [b.id, b.status]));
    assert(byId[bookingIds[0]] === 'attended', 'Attended booking should stay attended');
    assert(byId[bookingIds[1]] === 'no_show', `Second booking should be no_show, got ${byId[bookingIds[1]]}`);
    console.log('✓ After class ends: booked → no_show, attended unchanged');

    // 9) Dashboard no_show in stats
    const dash3 = await api('/api/dashboard/gym', token);
    const row3 = dash3.json.classSessionStats.sessions.find((s) => s.classId === gymClass.id);
    assert(row3.attended === 1, `Final attended=1, got ${row3.attended}`);
    assert(row3.noShow === 1, `Final noShow=1, got ${row3.noShow}`);
    assert(row3.booked === 0, `Final booked=0, got ${row3.booked}`);
    console.log('✓ Dashboard stats show noShow=1');

    // 10) Cannot mark attended again on no_show booking
    const badPatch = await api(
      `/api/gyms/${gym.id}/classes/${gymClass.id}/bookings/${bookingIds[1]}`,
      token,
      { method: 'PATCH', body: JSON.stringify({ status: 'attended' }) },
    );
    assert(badPatch.res.status === 400, 'Should reject attended on non-booked booking');
    console.log('✓ PATCH attended rejected for no_show booking');

    console.log('\n=== All flow checks passed ===');
  } finally {
    await prisma.gymClassBooking.deleteMany({ where: { id: { in: bookingIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: emails } } }).catch(() => {});
    await prisma.gymClass.delete({ where: { id: gymClass.id } }).catch(() => {});
  }
}

main()
  .catch((e) => {
    console.error('\n✗ FLOW FAILED:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
