import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { RoleName } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { appConfig } from '../../config/app.config';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

type AppConfig = ReturnType<typeof appConfig>;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('auth.jwtSecret', { infer: true }),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (payload.purpose === 'password_reset') {
      throw new UnauthorizedException(
        'Use this token only on the reset-password step, not as a session.',
      );
    }
    return {
      id: payload.sub,
      email: payload.email,
      platformRole: payload.platformRole ?? RoleName.USER,
    };
  }
}
