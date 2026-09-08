import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
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

    const key = `products/${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    await this.getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      url: `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    };
  }

  // Public catalog (Home/Shop) — active only, newest first.
  findAllActive() {
    return this.prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Admin/Manager product list — everything, including deactivated stock.
  findAllForStaff() {
    return this.prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { variants: { orderBy: { createdAt: 'asc' } } },
    });
    if (!product || !product.active) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async findOneForStaff(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: { orderBy: { createdAt: 'asc' } } },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async create(dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({ data: dto });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('A product with this slug already exists');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOneForStaff(id);
    try {
      return await this.prisma.product.update({ where: { id }, data: dto });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('A product with this slug already exists');
      }
      throw err;
    }
  }

  // No hard delete: OrderItem rows reference Product, and a shirt someone
  // already bought must keep showing correctly in their order history.
  // "Removing" a product from sale is deactivation (active: false), which
  // update() already supports.
}
