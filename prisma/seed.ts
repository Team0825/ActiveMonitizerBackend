import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Activity Monetizer Pro enterprise data...');

  // 1. Default Institution
  const defaultInstitution = await prisma.institution.upsert({
    where: { code: 'NIST-MAIN' },
    update: {
      name: 'National Institute of Science & Technology',
      board: 'Central Board of Secondary & Higher Education',
      location: 'Main Campus, Academic Complex',
    },
    create: {
      code: 'NIST-MAIN',
      name: 'National Institute of Science & Technology',
      board: 'Central Board of Secondary & Higher Education',
      location: 'Main Campus, Academic Complex',
      logoUrl: '',
      isActive: true,
    },
  });

  // 2. Default Departments
  const deptCse = await prisma.department.upsert({
    where: {
      institutionId_code: {
        institutionId: defaultInstitution.id,
        code: 'CSE',
      },
    },
    update: {},
    create: {
      name: 'Computer Science & Engineering',
      code: 'CSE',
      description: 'Department of Computer Science & Information Technology',
      institutionId: defaultInstitution.id,
      isActive: true,
    },
  });

  await prisma.department.upsert({
    where: {
      institutionId_code: {
        institutionId: defaultInstitution.id,
        code: 'IT',
      },
    },
    update: {},
    create: {
      name: 'Information Technology',
      code: 'IT',
      description: 'Department of Information Technology',
      institutionId: defaultInstitution.id,
      isActive: true,
    },
  });

  await prisma.department.upsert({
    where: {
      institutionId_code: {
        institutionId: defaultInstitution.id,
        code: 'ECE',
      },
    },
    update: {},
    create: {
      name: 'Electronics & Communication',
      code: 'ECE',
      description: 'Department of Electronics & Communication Engineering',
      institutionId: defaultInstitution.id,
      isActive: true,
    },
  });

  // 3. Super Admin User
  const adminHash = await bcrypt.hash('ChangeMe123!', 10);
  const superAdmin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      isSuperAdmin: true,
      role: 'ADMIN',
      institutionId: defaultInstitution.id,
    },
    create: {
      role: 'ADMIN',
      isSuperAdmin: true,
      username: 'admin',
      name: 'System Super Administrator',
      passwordHash: adminHash,
      email: 'admin@example.edu',
      institutionId: defaultInstitution.id,
    },
  });

  // 4. Teacher User
  const teacherHash = await bcrypt.hash('Teacher123!', 10);
  const teacher = await prisma.user.upsert({
    where: { username: 'teacher01' },
    update: {
      institutionId: defaultInstitution.id,
      departmentId: deptCse.id,
    },
    create: {
      role: 'TEACHER',
      username: 'teacher01',
      name: 'Prof. Alexander Wright',
      passwordHash: teacherHash,
      email: 'teacher01@example.edu',
      mobile: '+1-555-0192',
      institutionId: defaultInstitution.id,
      departmentId: deptCse.id,
      createdById: superAdmin.id,
    },
  });

  // 5. Student User
  const studentHash = await bcrypt.hash('Student123!', 10);
  const student = await prisma.user.upsert({
    where: { username: 'student01' },
    update: {
      institutionId: defaultInstitution.id,
      departmentId: deptCse.id,
    },
    create: {
      role: 'STUDENT',
      username: 'student01',
      name: 'David Vance',
      passwordHash: studentHash,
      regNumber: 'STU-2026-0001',
      classId: 'CS101',
      email: 'student01@example.edu',
      mobile: '+1-555-0144',
      institutionId: defaultInstitution.id,
      departmentId: deptCse.id,
      createdById: superAdmin.id,
    },
  });

  // 6. Enterprise License
  await prisma.license.upsert({
    where: { licenseNumber: 'AMPRO-2026-8841-9920' },
    update: {
      institutionId: defaultInstitution.id,
      status: 'ACTIVE',
      isActivated: true,
    },
    create: {
      licenseNumber: 'AMPRO-2026-8841-9920',
      activationKey: 'ACT-9821-4412-8831',
      institutionId: defaultInstitution.id,
      licenseType: 'ENTERPRISE',
      status: 'ACTIVE',
      isActivated: true,
      maxPcs: 250,
      machineName: 'CAMPUS-MASTER-NODE-01',
      machineFingerprint: 'AM-LOCAL-DEV-MACHINE-01',
      activatedAt: new Date(),
      lastValidatedAt: new Date(),
    },
  });

  // 7. Standby License for Testing Activation
  await prisma.license.upsert({
    where: { licenseNumber: 'AMPRO-2026-1029-4472' },
    update: {},
    create: {
      licenseNumber: 'AMPRO-2026-1029-4472',
      activationKey: 'ACT-3382-7719-0045',
      institutionId: defaultInstitution.id,
      licenseType: 'PRO',
      status: 'ACTIVE',
      isActivated: false,
      maxPcs: 100,
    },
  });

  // 8. Default App Themes
  const interfaces = ['GLOBAL', 'ADMIN', 'TEACHER', 'AGENT', 'ANDROID'];
  for (const iface of interfaces) {
    const existing = await prisma.appTheme.findFirst({
      where: { targetInterface: iface, isActive: true },
    });
    if (!existing) {
      await prisma.appTheme.create({
        data: {
          targetInterface: iface,
          themeName: `${iface} Default Theme`,
          themeMode: 'AUTO',
          palette: 'DEFAULT',
          primaryColor: '#2563EB',
          secondaryColor: '#0F172A',
          accentColor: '#22C55E',
          backgroundColor: '#0F172A',
          cardBackground: '#1E293B',
          textColor: '#FFFFFF',
          mutedTextColor: '#94A3B8',
          buttonColor: '#2563EB',
          buttonTextColor: '#FFFFFF',
          headerColor: '#0F172A',
          sidebarColor: '#0F172A',
          borderColor: '#334155',
          statusSuccess: '#22C55E',
          statusWarning: '#F59E0B',
          statusDanger: '#EF4444',
          statusInfo: '#3B82F6',
          institutionName: 'National Institute of Science & Technology',
          institutionBoard: 'Central Board of Secondary & Higher Education',
          institutionLocation: 'Main Campus, Academic Complex',
          institutionId: defaultInstitution.id,
          isActive: true,
        },
      });
    }
  }

  console.log('✅ Activity Monetizer Pro database successfully seeded:');
  console.log(`  Super Admin → username: ${superAdmin.username}  password: ChangeMe123!`);
  console.log(`  Teacher     → username: ${teacher.username}    password: Teacher123!`);
  console.log(`  Student     → username: ${student.username}    password: Student123!`);
  console.log(`  Institution → ${defaultInstitution.name} (${defaultInstitution.code})`);
  console.log(`  Active Key  → ACT-9821-4412-8831`);
  console.log(`  Standby Key → ACT-3382-7719-0045`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
