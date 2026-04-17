import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  private readonly roleIdByName = new Map<RoleName, string>();

  constructor(private readonly prisma: PrismaService) {}

  async getRoleId(name: RoleName): Promise<string> {
    const cached = this.roleIdByName.get(name);
    if (cached) {
      return cached;
    }

    const role = await this.prisma.role.findUnique({ where: { name } });

    if (!role) {
      throw new ServiceUnavailableException(
        `Role "${name}" is missing in the database. Run: npx prisma db seed`,
      );
    }

    this.roleIdByName.set(name, role.id);
    return role.id;
  }
}
