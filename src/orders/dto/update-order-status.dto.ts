import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatus, PaymentStatus } from '@prisma/client';

// Admin/Manager only. No state-machine enforcement (e.g. blocking
// DELIVERED -> PENDING) — deliberately simple for a solo-founder,
// low-volume store; staff are trusted to set this correctly.
export class UpdateOrderStatusDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
}
