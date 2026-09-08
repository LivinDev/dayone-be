import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Role } from '@prisma/client';
import {
  normalizeEmail,
  normalizePassword,
} from '../common/utils/credentials.util';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const email = normalizeEmail(dto.email);
    const password = normalizePassword(dto.password);
    if (password !== normalizePassword(dto.confirmPassword)) {
      throw new ConflictException('Passwords do not match');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashed = await bcrypt.hash(password, 10);
    // role is never taken from the request body — every self-signup is a CUSTOMER.
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashed,
        name: dto.fullName,
        role: Role.CUSTOMER,
      },
    });

    return this.buildAuthResponse(user.id, user.role, user.email, user.name);
  }

  async login(dto: LoginDto) {
    const email = normalizeEmail(dto.email);
    const password = normalizePassword(dto.password);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user.id, user.role, user.email, user.name);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    // Always return silently either way — don't leak whether an email is registered.
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    // TODO: no email provider wired up yet — log the reset link for now so the flow
    // is testable end-to-end. Replace with a real transactional email before launch.
    console.log(
      `[auth] Password reset requested for ${user.email}. Raw token: ${rawToken}`,
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');
    const user = await this.prisma.user.findUnique({
      where: { passwordResetToken: hashedToken },
    });

    if (
      !user ||
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ) {
      throw new UnauthorizedException('Reset link is invalid or has expired');
    }

    const password = await bcrypt.hash(normalizePassword(dto.newPassword), 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password, passwordResetToken: null, passwordResetExpires: null },
    });
  }

  private buildAuthResponse(
    userId: string,
    role: Role,
    email: string,
    name: string | null,
  ) {
    const accessToken = this.jwt.sign({ sub: userId, role });
    return { accessToken, user: { id: userId, email, name, role } };
  }
}
