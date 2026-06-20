'use strict';
const { Client } = require('pg');
const { randomUUID } = require('crypto');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    // جلب البيانات
    const clientsRes = await client.query('SELECT id FROM "Client" ORDER BY id');
    const employeesRes = await client.query('SELECT id, "nameAr", name FROM "Employee" ORDER BY id');
    const servicesRes = await client.query(`
      SELECT s.id, s."nameAr", s.price, s."durationMins",
             sc."nameAr" AS cat, d."nameAr" AS dept
      FROM "Service" s
      LEFT JOIN "ServiceCategory" sc ON sc.id = s."categoryId"
      LEFT JOIN "Department" d ON d.id = sc."departmentId"
      ORDER BY s.id
    `);
    const branchRes = await client.query('SELECT id, "nameAr" FROM "Branch" ORDER BY id LIMIT 1');
    const maxBookingRes = await client.query('SELECT COALESCE(MAX("bookingNumber"), 0) AS max FROM "Booking"');

    const clients = clientsRes.rows;
    const employees = employeesRes.rows;
    const services = servicesRes.rows;
    const branch = branchRes.rows[0];
    let nextBookingNumber = parseInt(maxBookingRes.rows[0].max) + 1;

    if (!clients.length || !employees.length || !services.length || !branch) {
      console.error('Missing seed data: clients/employees/services/branch');
      console.error(`clients: ${clients.length}, employees: ${employees.length}, services: ${services.length}, branch: ${branch ? 'found' : 'missing'}`);
      process.exit(1);
    }

    console.log(`Found: ${clients.length} clients, ${employees.length} employees, ${services.length} services, branch: ${branch.nameAr}`);

    const statusCycle = ['CONFIRMED', 'COMPLETED', 'PENDING', 'CONFIRMED', 'NO_SHOW', 'CANCELLED', 'COMPLETED'];
    const deliveryTypes = ['IN_PERSON', 'IN_PERSON', 'ONLINE', 'IN_PERSON', 'IN_PERSON', 'ONLINE', 'IN_PERSON', 'IN_PERSON', 'ONLINE', 'IN_PERSON', 'IN_PERSON', 'ONLINE', 'IN_PERSON', 'ONLINE'];
    const sources = ['RECEPTION', 'ONLINE', 'RECEPTION', 'RECEPTION', 'ONLINE', 'RECEPTION', 'RECEPTION', 'ONLINE', 'RECEPTION', 'RECEPTION', 'ONLINE', 'RECEPTION', 'RECEPTION', 'ONLINE'];

    const now = new Date();
    const bookings = [];

    for (let i = 0; i < 14; i++) {
      const svc = services[i % services.length];
      const emp = employees[i % employees.length];
      const cli = clients[i % clients.length];

      const dayOffset = i - 7; // من -7 إلى +6
      const hourUtc = 6 + (i % 8); // 6 إلى 13 UTC = 9ص إلى 4م رياض

      const scheduledAt = new Date(now);
      scheduledAt.setDate(scheduledAt.getDate() + dayOffset);
      scheduledAt.setUTCHours(hourUtc, 0, 0, 0);

      const durationMins = parseInt(svc.durationmins) || 60;
      const endsAt = new Date(scheduledAt.getTime() + durationMins * 60 * 1000);

      // createdAt: قبل scheduledAt بأيام مختلفة
      const createdAt = new Date(scheduledAt.getTime() - (1 + i * 3) * 60 * 60 * 1000);

      const empName = emp.namear || emp.name;
      const catName = svc.cat || svc.namear;
      const deptName = svc.dept || null;

      bookings.push([
        randomUUID(),                         // id
        branch.id,                            // branchId
        cli.id,                               // clientId
        emp.id,                               // employeeId
        svc.id,                               // serviceId
        scheduledAt.toISOString(),            // scheduledAt
        endsAt.toISOString(),                 // endsAt
        durationMins,                         // durationMins
        svc.price,                            // price
        nextBookingNumber++,                  // bookingNumber
        now.toISOString(),                    // updatedAt
        deliveryTypes[i],                     // deliveryType
        'INDIVIDUAL',                         // bookingType
        statusCycle[i % statusCycle.length],  // status
        'SAR',                                // currency
        false,                                // payAtClinic
        createdAt.toISOString(),              // createdAt
        sources[i],                           // source
        svc.price.toString(),                 // priceSnapshot
        durationMins.toString(),              // durationMinutesSnapshot
        branch.namear,                        // branchNameSnapshot
        empName,                              // employeeNameSnapshot
        svc.namear,                           // serviceNameSnapshot
        catName,                              // categoryNameSnapshot
        deptName,                             // departmentNameSnapshot
      ]);
    }

    // بناء INSERT واحد
    const cols = [
      'id', 'branchId', 'clientId', 'employeeId', 'serviceId',
      'scheduledAt', 'endsAt', 'durationMins', 'price', 'bookingNumber',
      'updatedAt', 'deliveryType', 'bookingType', 'status', 'currency',
      'payAtClinic', 'createdAt', 'source',
      'priceSnapshot', 'durationMinutesSnapshot', 'branchNameSnapshot',
      'employeeNameSnapshot', 'serviceNameSnapshot', 'categoryNameSnapshot',
      'departmentNameSnapshot'
    ];
    const quotedCols = cols.map(c => `"${c}"`).join(', ');
    const placeholders = bookings.map((_, rowIdx) =>
      '(' + cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`).join(', ') + ')'
    ).join(',\n');
    const values = bookings.flat();

    const sql = `INSERT INTO "Booking" (${quotedCols}) VALUES ${placeholders}`;
    const result = await client.query(sql, values);
    console.log(`✓ Inserted ${result.rowCount} bookings`);

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
