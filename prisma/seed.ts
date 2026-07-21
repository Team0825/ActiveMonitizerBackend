import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('ChangeMe123!', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      role: 'ADMIN',
      username: 'admin',
      passwordHash: adminHash,
      email: 'admin@example.edu',
    },
  });

  const teacherHash = await bcrypt.hash('Teacher123!', 10);
  const teacher = await prisma.user.upsert({
    where: { username: 'teacher01' },
    update: {},
    create: {
      role: 'TEACHER',
      username: 'teacher01',
      passwordHash: teacherHash,
      email: 'teacher01@example.edu',
      createdById: admin.id,
    },
  });

  const studentHash = await bcrypt.hash('Student123!', 10);
  const student = await prisma.user.upsert({
    where: { username: 'student01' },
    update: {},
    create: {
      role: 'STUDENT',
      username: 'student01',
      passwordHash: studentHash,
      regNumber: 'STU-2026-0001',
      classId: 'CS101',
      email: 'student01@example.edu',
      createdById: admin.id,
    },
  });

  console.log('Seeded demo accounts (change all passwords before real use):');
  console.log(`  Admin    → username: ${admin.username}    password: ChangeMe123!`);
  console.log(`  Teacher  → username: ${teacher.username} password: Teacher123!`);
  console.log(`  Student  → username: ${student.username} password: Student123!  regNumber: ${student.regNumber}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
