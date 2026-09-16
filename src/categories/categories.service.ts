import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  // Public — Collection tabs + admin product-form checkboxes both read this.
  async findAll() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return categories.map(({ _count, ...c }) => ({
      ...c,
      productCount: _count.products,
    }));
  }

  async create(dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({ data: dto });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('A category with this slug already exists');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOrThrow(id);
    try {
      return await this.prisma.category.update({ where: { id }, data: dto });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('A category with this slug already exists');
      }
      throw err;
    }
  }

  // Hard delete — the implicit m2m join table cascades, so any products
  // tagged with this category are just detached, not blocked or deleted
  // themselves. Category membership is optional/many-valued, unlike a
  // required FK (e.g. ProductVariant's ordered-OrderItem guard), so there's
  // nothing to guard against here.
  async remove(id: string) {
    await this.findOrThrow(id);
    await this.prisma.category.delete({ where: { id } });
  }

  private async findOrThrow(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }
}
