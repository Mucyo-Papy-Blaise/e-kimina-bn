import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, RoleName } from '@prisma/client';
import { hash } from 'bcryptjs';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

/** Shared dev password for all seeded users (change in production). */
const SEED_PASSWORD = 'Password123!';
const BCRYPT_ROUNDS = 12;

const SEED_GROUP_NAME = 'Seed Demo Group';

/** One user per role: platform SUPER_ADMIN + three group-scoped roles in the seed group. */
const SEED_USERS = [
  {
    email: 'superadmin@ekimina.local',
    fullName: 'Seed Super Admin',
    role: RoleName.SUPER_ADMIN,
    scope: 'platform' as const,
  },
  {
    email: 'groupadmin@ekimina.local',
    fullName: 'Seed Group Admin',
    role: RoleName.GROUP_ADMIN,
    scope: 'group' as const,
  },
  {
    email: 'treasurer@ekimina.local',
    fullName: 'Seed Treasurer',
    role: RoleName.TREASURER,
    scope: 'group' as const,
  },
  {
    email: 'member@ekimina.local',
    fullName: 'Seed Member',
    role: RoleName.MEMBER,
    scope: 'group' as const,
  },
] as const;

async function main(): Promise<void> {
  const passwordHash = await hash(SEED_PASSWORD, BCRYPT_ROUNDS);

  for (const name of Object.values(RoleName)) {
    await prisma.role.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }

  const roleId = async (name: RoleName) =>
    (await prisma.role.findUniqueOrThrow({ where: { name } })).id;

  const idByRole = {} as Record<RoleName, string>;
  for (const name of Object.values(RoleName)) {
    idByRole[name] = await roleId(name);
  }

  const userPlatformRoleId = idByRole[RoleName.USER];

  const usersMissingPlatform = await prisma.user.findMany({
    where: { platformRoles: { none: {} } },
    select: { id: true },
  });

  for (const u of usersMissingPlatform) {
    await prisma.userPlatformRole.create({
      data: {
        userId: u.id,
        roleId: userPlatformRoleId,
      },
    });
  }

  const usersByEmail = new Map<
    string,
    { id: string; email: string; fullName: string }
  >();

  for (const def of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: { email: def.email },
      create: {
        email: def.email,
        fullName: def.fullName,
        passwordHash,
        emailVerified: true,
        platformRoles: {
          create: {
            role: { connect: { name: RoleName.USER } },
          },
        },
      },
      update: {
        fullName: def.fullName,
        passwordHash,
        emailVerified: true,
      },
    });
    usersByEmail.set(def.email, user);
  }

  const groupAdminUser = usersByEmail.get('groupadmin@ekimina.local')!;

  let group = await prisma.group.findFirst({
    where: { name: SEED_GROUP_NAME },
  });

  console.log('this is group', group);

  if (!group) {
    group = await prisma.group.create({
      data: {
        name: SEED_GROUP_NAME,
        description:
          'Seeded group: GROUP_ADMIN, TREASURER, MEMBER (one user per role).',
        createdById: groupAdminUser.id,
        isVerified: true,
        minMembers: 100,
      },
    });
  }

  for (const def of SEED_USERS) {
    const user = usersByEmail.get(def.email)!;
    const groupRoleId = idByRole[def.role];

    if (def.scope === 'platform') {
      await prisma.userPlatformRole.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          roleId: groupRoleId,
        },
        update: {
          roleId: groupRoleId,
        },
      });
      await prisma.userGroup.deleteMany({
        where: {
          userId: user.id,
        },
      });
    } else {
      await prisma.userPlatformRole.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          roleId: userPlatformRoleId,
        },
        update: {
          roleId: userPlatformRoleId,
        },
      });
      await prisma.userGroup.upsert({
        where: {
          userId_groupId: {
            userId: user.id,
            groupId: group.id,
          },
        },
        create: {
          userId: user.id,
          groupId: group.id,
          roleId: groupRoleId,
        },
        update: {
          roleId: groupRoleId,
        },
      });
    }
  }

  console.log(`
Seeded ${SEED_USERS.length} users (password for all: "${SEED_PASSWORD}")
`);

  for (const def of SEED_USERS) {
    const u = usersByEmail.get(def.email)!;
    if (def.scope === 'platform') {
      console.log(`  ${def.role.padEnd(12)} → ${u.email}  (UserPlatformRole)`);
    } else {
      console.log(
        `  ${def.role.padEnd(12)} → ${u.email}  (UserGroup in "${SEED_GROUP_NAME}")`,
      );
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
