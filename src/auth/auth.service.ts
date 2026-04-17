import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { appConfig } from '../config/app.config';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

type AppConfig = ReturnType<typeof appConfig>;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const passwordHash = await hash(
      registerDto.password,
      this.configService.get('auth.bcryptSaltRounds', { infer: true }),
    );

    const user = await this.usersService.create({
      email: registerDto.email,
      fullName: registerDto.fullName,
      passwordHash,
      phoneNumber: registerDto.phoneNumber,
      image: registerDto.image,
    });

    return this.buildAuthResponse(user);
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid Credentials.');
    }

    const passwordMatches = await compare(loginDto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid Credentials.');
    }

    const safeUser = await this.usersService.findById(user.id);

    return this.buildAuthResponse(safeUser);
  }

  private async buildAuthResponse(
    user: Awaited<ReturnType<UsersService['findById']>>,
  ): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      platformRole: user.platformRole,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user,
    };
  }
}
