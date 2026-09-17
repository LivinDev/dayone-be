import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { compressImage } from '../common/utils/image-processing.util';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // Lazy — constructed on first use, not at module load, so the app still
  // boots cleanly before AWS_* env vars are ever set (matches the "COD works
  // without payment gateway creds" pattern used elsewhere in this backend).
  private s3Client: S3Client | null = null;
  private getS3Client() {
    if (!this.s3Client) {
      this.s3Client = new S3Client({ region: process.env.AWS_REGION });
    }
    return this.s3Client;
  }

  async uploadImage(file: Express.Multer.File) {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket || !process.env.AWS_REGION) {
      throw new InternalServerErrorException(
        "Image storage isn't configured yet — set AWS_REGION/AWS_S3_BUCKET/AWS credentials in .env",
      );
    }

    const compressed = await compressImage(file.buffer);
    const baseName = file.originalname.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '-');
    const key = `products/${randomUUID()}-${baseName}.${compressed.extension}`;
    await this.getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: compressed.buffer,
        ContentType: compressed.contentType,
      }),
    );

    return {
      url: `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    };
  }

  // Public catalog (Home/Collection) — active only, newest first. Optional
  // single-slug category filter (?category=<slug> on the controller) —
  // tabs are exclusive, never multiple at once, so this stays single-value
  // rather than the old comma-list-of-enum-values design.
  async findAllActive(categorySlug?: string, q?: string) {
    const term = q?.trim();
    const where: Prisma.ProductWhereInput = {
      active: true,
      ...(categorySlug ? { categories: { some: { slug: categorySlug } } } : {}),
    };

    if (!term) {
      return this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { categories: true },
      });
    }

    // No search infra beyond Postgres itself — fine at this catalog size
    // (single digits/low hundreds of products). Case-insensitive substring
    // match across the fields a shopper would actually type: name,
    // description, fit, and any tagged category name. Revisit with Postgres
    // full-text search (tsvector + GIN index) only if the catalog grows
    // enough that relevance ranking/typo-tolerance actually starts to
    // matter — no reason to reach for external search infra before that.
    const matches = { contains: term, mode: Prisma.QueryMode.insensitive };
    const products = await this.prisma.product.findMany({
      where: {
        ...where,
        OR: [
          { name: matches },
          { description: matches },
          { fit: matches },
          { categories: { some: { name: matches } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: { categories: true },
    });

    // Rank name matches above description/fit/category-only matches so the
    // most obviously relevant result shows first, without needing a real
    // scoring engine.
    const lowerTerm = term.toLowerCase();
    return products.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().includes(lowerTerm) ? 0 : 1;
      const bNameMatch = b.name.toLowerCase().includes(lowerTerm) ? 0 : 1;
      return aNameMatch - bNameMatch;
    });
  }

  // Admin/Manager product list — everything, including deactivated stock.
  findAllForStaff() {
    return this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: { categories: true },
    });
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        variants: { orderBy: { createdAt: 'asc' } },
        categories: true,
      },
    });
    if (!product || !product.active) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async findOneForStaff(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { createdAt: 'asc' } },
        categories: true,
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async create(dto: CreateProductDto) {
    const { categories, ...rest } = dto;
    this.assertValidMrp(rest.mrpInPaise, rest.priceInPaise);
    try {
      return await this.prisma.product.create({
        data: {
          ...rest,
          ...(categories
            ? { categories: { connect: categories.map((id) => ({ id })) } }
            : {}),
        },
        include: { categories: true },
      });
    } catch (err) {
      throw this.mapProductWriteError(err);
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.findOneForStaff(id);
    const { categories, ...rest } = dto;
    if (rest.mrpInPaise !== undefined) {
      this.assertValidMrp(
        rest.mrpInPaise,
        rest.priceInPaise ?? existing.priceInPaise,
      );
    }
    try {
      return await this.prisma.product.update({
        where: { id },
        // `set` (not `connect`) — the admin form always submits the full
        // current selection, so this replaces the association rather than
        // only adding to it.
        data: {
          ...rest,
          ...(categories
            ? { categories: { set: categories.map((id) => ({ id })) } }
            : {}),
        },
        include: { categories: true },
      });
    } catch (err) {
      throw this.mapProductWriteError(err);
    }
  }

  // A "was" price below the actual selling price isn't a discount, it's
  // just wrong data — reject it here rather than let the storefront show a
  // negative/zero discount.
  private assertValidMrp(mrpInPaise: number | undefined, priceInPaise: number) {
    if (mrpInPaise != null && mrpInPaise < priceInPaise) {
      throw new BadRequestException(
        'MRP must be greater than or equal to the selling price',
      );
    }
  }

  private mapProductWriteError(err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException('A product with this slug already exists');
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return new BadRequestException(
        'One or more selected categories no longer exist',
      );
    }
    return err;
  }

  // No hard delete: OrderItem rows reference Product, and a shirt someone
  // already bought must keep showing correctly in their order history.
  // "Removing" a product from sale is deactivation (active: false), which
  // update() already supports.
}
