import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { appConfig } from '../config/app.config';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterPendingDto } from './dto/register-result.dto';
import { CompletePasswordResetDto } from './dto/complete-password-reset.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

type AppConfig = ReturnType<typeof appConfig>;

export type RegisterResult = AuthResponseDto | RegisterPendingDto;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private getOtpExpiryDate(): Date {
    const minutes = Number.parseInt(
      process.env.OTP_EXPIRATION_MINUTES ?? '15',
      10,
    );
    const safe = Number.isFinite(minutes) && minutes > 0 ? minutes : 15;
    return new Date(Date.now() + safe * 60 * 1000);
  }

  private generateOtp(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  async register(registerDto: RegisterDto): Promise<RegisterResult> {
    const invitationToken = registerDto.invitationToken?.trim();
    if (invitationToken) {
      const treasurerInv = await this.prisma.treasurerInvitation.findUnique({
        where: { token: invitationToken },
      });
      if (treasurerInv) {
        return this.registerWithTreasurerInvitation(registerDto, invitationToken);
      }
      const memberInv = await this.prisma.memberInvitation.findUnique({
        where: { token: invitationToken },
      });
      if (memberInv) {
        return this.registerWithMemberInvitation(registerDto, invitationToken);
      }
      throw new BadRequestException('Invalid invitation token.');
    }

    const email = registerDto.email.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      if (!existingUser.isActive) {
        throw new BadRequestException(
          'Complete registration using the invitation link sent to your email.',
        );
      }
      throw new ConflictException('A user with this email already exists.');
    }

    if (!process.env.SMTP_HOST?.trim()) {
      throw new BadRequestException(
        'Email verification requires SMTP. Set SMTP_* variables in .env.',
      );
    }

    const passwordHash = await hash(
      registerDto.password,
      this.configService.get('auth.bcryptSaltRounds', { infer: true }),
    );

    const otp = this.generateOtp();
    const otpHash = await hash(
      otp,
      this.configService.get('auth.bcryptSaltRounds', { infer: true }),
    );
    const expiresAt = this.getOtpExpiryDate();

    const user = await this.usersService.create({
      email,
      fullName: registerDto.fullName,
      passwordHash,
      phoneNumber: registerDto.phoneNumber,
      image: registerDto.image,
      emailVerified: false,
      emailVerificationOtpHash: otpHash,
      emailVerificationExpiresAt: expiresAt,
    });

    try {
      await this.emailService.sendVerificationEmail(
        email,
        otp,
        registerDto.fullName.split(/\s+/)[0] || registerDto.fullName,
      );
    } catch {
      await this.prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      throw new BadRequestException(
        'Could not send the verification email. Check SMTP settings and try again.',
      );
    }

    const pending: RegisterPendingDto = {
      needsEmailVerification: true,
      email,
      message: 'We sent a verification code to your email.',
    };
    return pending;
  }

  async previewTreasurerInvitation(token: string): Promise<{ email: string }> {
    const trimmed = token.trim();
    if (!trimmed) {
      throw new BadRequestException('Token is required.');
    }

    const invitation = await this.prisma.treasurerInvitation.findUnique({
      where: { token: trimmed },
      include: { user: { select: { email: true } } },
    });

    if (invitation && invitation.expiresAt >= new Date()) {
      return { email: invitation.user.email };
    }

    const memberInv = await this.prisma.memberInvitation.findUnique({
      where: { token: trimmed },
      include: { user: { select: { email: true } } },
    });

    if (memberInv && memberInv.expiresAt >= new Date()) {
      return { email: memberInv.user.email };
    }

    throw new NotFoundException('Invitation not found or expired.');
  }

  private async registerWithTreasurerInvitation(
    registerDto: RegisterDto,
    invitationToken: string,
  ): Promise<AuthResponseDto> {
    const invitation = await this.prisma.treasurerInvitation.findUnique({
      where: { token: invitationToken },
      include: { user: true },
    });

    if (!invitation || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation is invalid or has expired.');
    }

    const normalizedEmail = registerDto.email.trim().toLowerCase();
    if (invitation.user.email.toLowerCase() !== normalizedEmail) {
      throw new BadRequestException('Email does not match this invitation.');
    }

    if (invitation.user.isActive) {
      throw new BadRequestException('This account is already active.');
    }

    const passwordHash = await hash(
      registerDto.password,
      this.configService.get('auth.bcryptSaltRounds', { infer: true }),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: invitation.userId },
        data: {
          fullName: registerDto.fullName,
          passwordHash,
          phoneNumber: registerDto.phoneNumber,
          image: registerDto.image,
          isActive: true,
          emailVerified: true,
          emailVerificationOtpHash: null,
          emailVerificationExpiresAt: null,
        },
      });
      await tx.treasurerInvitation.delete({ where: { id: invitation.id } });
    });

    const user = await this.usersService.findById(invitation.userId);
    return this.buildAuthResponse(user);
  }

  private async registerWithMemberInvitation(
    registerDto: RegisterDto,
    invitationToken: string,
  ): Promise<AuthResponseDto> {
    const invitation = await this.prisma.memberInvitation.findUnique({
      where: { token: invitationToken },
      include: { user: true },
    });

    if (!invitation || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation is invalid or has expired.');
    }

    const normalizedEmail = registerDto.email.trim().toLowerCase();
    if (invitation.user.email.toLowerCase() !== normalizedEmail) {
      throw new BadRequestException('Email does not match this invitation.');
    }

    if (invitation.user.isActive) {
      throw new BadRequestException('This account is already active.');
    }

    const passwordHash = await hash(
      registerDto.password,
      this.configService.get('auth.bcryptSaltRounds', { infer: true }),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: invitation.userId },
        data: {
          fullName: registerDto.fullName,
          passwordHash,
          phoneNumber: registerDto.phoneNumber,
          image: registerDto.image,
          isActive: true,
          emailVerified: true,
          emailVerificationOtpHash: null,
          emailVerificationExpiresAt: null,
        },
      });
      await tx.memberInvitation.delete({ where: { id: invitation.id } });
    });

    const user = await this.usersService.findById(invitation.userId);
    return this.buildAuthResponse(user);
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<AuthResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or verification code.');
    }

    if (user.emailVerified) {
      throw new BadRequestException('This email is already verified.');
    }

    if (!user.emailVerificationOtpHash || !user.emailVerificationExpiresAt) {
      throw new BadRequestException(
        'No verification code pending. Request a new code.',
      );
    }

    if (user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException(
        'Verification code expired. Request a new code.',
      );
    }

    const matches = await compare(dto.otp, user.emailVerificationOtpHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid verification code.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationOtpHash: null,
        emailVerificationExpiresAt: null,
      },
    });

    const profile = await this.usersService.findById(user.id);
    return this.buildAuthResponse(profile);
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);

    const generic: { message: string } = {
      message:
        'If an account exists and needs verification, we sent a new code.',
    };

    if (!user || user.emailVerified || !user.isActive) {
      return generic;
    }

    if (!process.env.SMTP_HOST?.trim()) {
      return generic;
    }

    const otp = this.generateOtp();
    const otpHash = await hash(
      otp,
      this.configService.get('auth.bcryptSaltRounds', { infer: true }),
    );
    const expiresAt = this.getOtpExpiryDate();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationOtpHash: otpHash,
        emailVerificationExpiresAt: expiresAt,
      },
    });

    try {
      await this.emailService.sendVerificationEmail(
        email,
        otp,
        user.fullName.split(/\s+/)[0] || user.fullName,
      );
    } catch {
      // Do not reveal SMTP failure
    }

    return generic;
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);

    const generic: { message: string } = {
      message:
        'If an account exists for this email, we sent password reset instructions.',
    };

    if (!user || !user.isActive || !user.emailVerified) {
      return generic;
    }

    if (!process.env.SMTP_HOST?.trim()) {
      return generic;
    }

    const otp = this.generateOtp();
    const otpHash = await hash(
      otp,
      this.configService.get('auth.bcryptSaltRounds', { infer: true }),
    );
    const expiresAt = this.getOtpExpiryDate();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetOtpHash: otpHash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    try {
      await this.emailService.sendPasswordResetEmail(
        email,
        otp,
        user.fullName.split(/\s+/)[0] || user.fullName,
      );
    } catch {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetOtpHash: null,
          passwordResetExpiresAt: null,
        },
      });
    }

    return generic;
  }

  /** Step 1: validate email + OTP; returns a short-lived token for step 2 only. */
  async verifyResetOtp(
    dto: VerifyResetOtpDto,
  ): Promise<{ resetToken: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or verification code.');
    }

    if (!user.passwordResetOtpHash || !user.passwordResetExpiresAt) {
      throw new BadRequestException(
        'No password reset in progress. Request a new code.',
      );
    }

    if (user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException(
        'Reset code expired. Request a new password reset.',
      );
    }

    const matches = await compare(dto.otp, user.passwordResetOtpHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid verification code.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetOtpHash: null,
        passwordResetExpiresAt: null,
      },
    });

    const resetToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        purpose: 'password_reset' as const,
      },
      { expiresIn: '15m' },
    );

    return { resetToken };
  }

  /** Step 2: set new password; does not log the user in. */
  async completePasswordReset(
    dto: CompletePasswordResetDto,
  ): Promise<{ message: string }> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(dto.resetToken);
    } catch {
      throw new BadRequestException(
        'Invalid or expired reset session. Start the reset flow again.',
      );
    }

    if (payload.purpose !== 'password_reset') {
      throw new BadRequestException('Invalid reset session.');
    }

    const passwordHash = await hash(
      dto.password,
      this.configService.get('auth.bcryptSaltRounds', { infer: true }),
    );

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash },
    });

    return {
      message: 'Password updated. Sign in with your new password.',
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const email = loginDto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid Credentials.');
    }

    const passwordMatches = await compare(loginDto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid Credentials.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Complete registration using your invitation link before signing in.',
      );
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'Verify your email before signing in. Check your inbox for the code or request a new one from the sign-up page.',
      );
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
