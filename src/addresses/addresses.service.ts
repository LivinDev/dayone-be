import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto) {
    const existingCount = await this.prisma.address.count({
      where: { userId },
    });
    // A user's very first saved address becomes their default automatically —
    // there's otherwise no way to have a default without an extra step.
    const makeDefault = dto.isDefault === true || existingCount === 0;

    if (makeDefault) {
      return this.prisma.$transaction(async (tx) => {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
        return tx.address.create({ data: { ...dto, userId, isDefault: true } });
      });
    }

    return this.prisma.address.create({
      data: { ...dto, userId, isDefault: false },
    });
  }

  async update(userId: string, addressId: string, dto: UpdateAddressDto) {
    await this.findOwned(userId, addressId);

    if (dto.isDefault === true) {
      return this.prisma.$transaction(async (tx) => {
        await tx.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
        return tx.address.update({ where: { id: addressId }, data: dto });
      });
    }

    return this.prisma.address.update({ where: { id: addressId }, data: dto });
  }

  async remove(userId: string, addressId: string) {
    await this.findOwned(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
  }

  // Ownership check: a 404, not a 403 — don't reveal whether an address id
  // exists at all if it belongs to someone else.
  private async findOwned(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    return address;
  }
}
