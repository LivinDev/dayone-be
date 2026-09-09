import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';

@Injectable()
export class VariantsService {
  constructor(private prisma: PrismaService) {}

  async create(productId: string, dto: CreateVariantDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.assertNoDuplicate(productId, dto.color ?? null, dto.size);
    this.assertValidMrp(dto.mrpInPaise, dto.priceInPaise ?? product.priceInPaise);

    try {
      return await this.prisma.productVariant.create({
        data: { ...dto, productId },
      });
    } catch (err) {
      throw this.mapUniqueError(err);
    }
  }

  async update(id: string, dto: UpdateVariantDto) {
    const existing = await this.findOrThrow(id);

    if (dto.color !== undefined || dto.size !== undefined) {
      await this.assertNoDuplicate(
        existing.productId,
        dto.color !== undefined ? dto.color : existing.color,
        dto.size ?? existing.size,
        id,
      );
    }

    if (dto.mrpInPaise !== undefined) {
      let effectivePrice = dto.priceInPaise ?? existing.priceInPaise;
      if (effectivePrice == null) {
        const product = await this.prisma.product.findUniqueOrThrow({
          where: { id: existing.productId },
        });
        effectivePrice = product.priceInPaise;
      }
      this.assertValidMrp(dto.mrpInPaise, effectivePrice);
    }

    try {
      return await this.prisma.productVariant.update({
        where: { id },
        data: dto,
      });
    } catch (err) {
      throw this.mapUniqueError(err);
    }
  }

  async remove(id: string) {
    await this.findOrThrow(id);

    const orderedCount = await this.prisma.orderItem.count({
      where: { variantId: id },
    });
    if (orderedCount > 0) {
      throw new BadRequestException(
        "This variant has been ordered and can't be deleted — set its stock to 0 instead",
      );
    }

    await this.prisma.productVariant.delete({ where: { id } });
  }

  private async findOrThrow(id: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
    });
    if (!variant) {
      throw new NotFoundException('Variant not found');
    }
    return variant;
  }

  // Application-level duplicate guard: Postgres unique constraints treat
  // NULL != NULL, so two color-less variants of the same size wouldn't be
  // caught by the DB's @@unique([productId, color, size]) alone.
  private async assertNoDuplicate(
    productId: string,
    color: string | null,
    size: string,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.productVariant.findFirst({
      where: {
        productId,
        size,
        color,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (duplicate) {
      throw new ConflictException(
        `A variant with size "${size}"${color ? ` and color "${color}"` : ''} already exists for this product`,
      );
    }
  }

  private assertValidMrp(mrpInPaise: number | undefined, priceInPaise: number) {
    if (mrpInPaise != null && mrpInPaise < priceInPaise) {
      throw new BadRequestException('MRP must be greater than or equal to the selling price');
    }
  }

  private mapUniqueError(err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException('A variant with this SKU already exists');
    }
    return err;
  }
}
