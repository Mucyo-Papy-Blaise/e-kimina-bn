import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupMembershipStatus, Prisma, RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  phoneNumber: true,
  image: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export type GroupMembershipSummary = {
  groupId: string;
  groupName: string;
  role: RoleName;
};

export type SafeUserProfile = SafeUser & {
  /** Default platform scope is `USER` (see `UserPlatformRole`). */
  platformRole: RoleName;
  groupMemberships: GroupMembershipSummary[];
};

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  fullName: string;
  phoneNumber?: string;
  image?: string;
  emailVerified?: boolean;
  emailVerificationOtpHash?: string | null;
  emailVerificationExpiresAt?: Date | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private mapProfile(user: {
    id: string;
    email: string;
    fullName: string;
    phoneNumber: string | null;
    image: string | null;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    platformRoles: { role: { name: RoleName } }[];
    userGroups: {
      group: { id: string; name: string };
      role: { name: RoleName };
    }[];
  }): SafeUserProfile {
    const { platformRoles, userGroups, ...rest } = user;
    return {
      ...rest,
      platformRole: platformRoles[0]?.role.name ?? RoleName.USER,
      groupMemberships: userGroups.map((ug) => ({
        groupId: ug.group.id,
        groupName: ug.group.name,
        role: ug.role.name,
      })),
    };
  }

  private profileSelect() {
    return {
      ...userSelect,
      platformRoles: {
        take: 1,
        include: { role: { select: { name: true } } },
      },
      userGroups: {
        where: { membershipStatus: GroupMembershipStatus.ACTIVE },
        select: {
          group: { select: { id: true, name: true } },
          role: { select: { name: true } },
        },
      },
    } as const;
  }

  async create(input: CreateUserInput): Promise<SafeUserProfile> {
    try {
      const created = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          fullName: input.fullName,
          phoneNumber: input.phoneNumber,
          image: input.image,
          emailVerified: input.emailVerified ?? true,
          emailVerificationOtpHash: input.emailVerificationOtpHash ?? undefined,
          emailVerificationExpiresAt: input.emailVerificationExpiresAt ?? undefined,
          platformRoles: {
            create: {
              role: { connect: { name: RoleName.USER } },
            },
          },
        },
        select: this.profileSelect(),
      });

      return this.mapProfile(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A user with this email already exists.');
      }

      throw error;
    }
  }

  async findAll(): Promise<SafeUserProfile[]> {
    const users = await this.prisma.user.findMany({
      select: this.profileSelect(),
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map((user) => this.mapProfile(user));
  }

  async findById(id: string): Promise<SafeUserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.profileSelect(),
    });

    if (!user) {
      throw new NotFoundException(`User ${id} was not found.`);
    }

    return this.mapProfile(user);
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }
}
