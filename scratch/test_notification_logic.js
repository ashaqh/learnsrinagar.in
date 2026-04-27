import { resolveNotificationRecipientIds } from '../src/services/notificationSchema.server.js';
import * as dbModule from '../src/lib/db.js';

// Mock the db.query function
const originalQuery = dbModule.query;

async function runTest() {
  console.log('--- Starting Notification Recipient Logic Test ---');

  const mockData = {
    superAdmins: [{ id: 101 }, { id: 102 }],
    schoolAdmins: [{ id: 201 }],
    roleUsers: [{ id: 301 }, { id: 302 }]
  };

  // Override db.query with a mock
  dbModule.query = async (sql, params) => {
    if (sql.includes("r.name = 'super_admin'")) {
      return mockData.superAdmins;
    }
    if (sql.includes("s.users_id") || sql.includes("s.id = ?")) {
      return mockData.schoolAdmins;
    }
    if (sql.includes("r.name = ?") && (params[0] === 'teacher' || params[0] === 'parent')) {
        return mockData.roleUsers;
    }
    return [];
  };

  try {
    // Scenario 1: Target 'school'
    console.log('\nScenario 1: Target school (ID: 1)');
    const schoolRecipients = await resolveNotificationRecipientIds('school', 1);
    console.log('Resulting IDs:', schoolRecipients);
    if (schoolRecipients.includes(101) && schoolRecipients.includes(102)) {
      console.log('✅ Success: Super Admins included in school scope.');
    } else {
      console.log('❌ Failure: Super Admins missing from school scope.');
    }

    // Scenario 2: Target 'all'
    console.log('\nScenario 2: Target all');
    const allRecipients = await resolveNotificationRecipientIds('all', null);
    console.log('Resulting IDs:', allRecipients);
    if (allRecipients.includes(101) && allRecipients.includes(102)) {
      console.log('✅ Success: Super Admins included in global scope.');
    } else {
      console.log('❌ Failure: Super Admins missing from global scope.');
    }

    // Scenario 3: Target 'role' (e.g., teacher)
    console.log('\nScenario 3: Target role (teacher)');
    const roleRecipients = await resolveNotificationRecipientIds('role', 'teacher');
    console.log('Resulting IDs:', roleRecipients);
    if (roleRecipients.includes(101) && roleRecipients.includes(102)) {
      console.log('✅ Success: Super Admins included in role scope.');
    } else {
      console.log('❌ Failure: Super Admins missing from role scope.');
    }

  } catch (err) {
    console.error('Test Error:', err);
  } finally {
    // Restore original query
    dbModule.query = originalQuery;
  }
}

runTest();
