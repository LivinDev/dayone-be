import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { EntryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { compressImage } from '../common/utils/image-processing.util';
import { CreateTimelineEntryDto } from './dto/create-timeline-entry.dto';
import { UpdateTimelineEntryDto } from './dto/update-timeline-entry.dto';
import { SectionInputDto } from './dto/section-input.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

const SECTIONS_INCLUDE = {
  sections: {
    orderBy: { order: 'asc' as const },
    include: { images: { orderBy: { order: 'asc' as const } } },
  },
};

@Injectable()
export class TimelineService {
  constructor(private prisma: PrismaService) {}

  // Lazy — same pattern as ProductsService.getS3Client()/InvoicesService,
  // not constructed at module load, so the app still boots without AWS_*
  // env vars set.
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
    const key = `timeline/${randomUUID()}-${baseName}.${compressed.extension}`;
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

  // Public — anyone tapping the physical tag (or visiting /story/:code
  // directly) sees this, no auth. Only ever-approved entries, oldest first
  // (a timeline reads chronologically) — the status filter is a no-op today
  // since everything auto-approves, but stays so a future moderation flip
  // doesn't need a second code change here.
  async findPublicForTag(tagId: string) {
    const tag = await this.prisma.nfcTag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    return this.prisma.timelineEntry.findMany({
      where: { tagId, status: EntryStatus.APPROVED },
      orderBy: { entryDate: 'asc' },
      include: SECTIONS_INCLUDE,
    });
  }

  // Owner-only — same list, but includes anything not yet approved (a no-op
  // today, real once moderation exists) so the owner's own management
  // screen never hides their own pending work from them.
  async findMineForTag(userId: string, tagId: string) {
    const tag = await this.prisma.nfcTag.findFirst({
      where: { id: tagId, ownerId: userId },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    return this.prisma.timelineEntry.findMany({
      where: { tagId },
      orderBy: { entryDate: 'desc' },
      include: SECTIONS_INCLUDE,
    });
  }

  // Creates a day and its first section(s) in one nested write — Prisma
  // batches nested creates atomically, no explicit $transaction needed.
  async create(userId: string, tagId: string, dto: CreateTimelineEntryDto) {
    const tag = await this.prisma.nfcTag.findFirst({
      where: { id: tagId, ownerId: userId },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return this.prisma.timelineEntry.create({
      data: {
        tagId,
        location: dto.location,
        occasion: dto.occasion,
        ...(dto.entryDate ? { entryDate: new Date(dto.entryDate) } : {}),
        sections: {
          create: dto.sections.map((section, sectionIndex) =>
            this.sectionCreateData(section, sectionIndex),
          ),
        },
      },
      include: SECTIONS_INCLUDE,
    });
  }

  private sectionCreateData(section: SectionInputDto, order: number) {
    return {
      caption: section.caption,
      order,
      images: {
        create: section.images.map((image, imageIndex) => ({
          url: image.url,
          caption: image.caption,
          order: imageIndex,
        })),
      },
    };
  }

  // Day-level fields only (location/occasion/date) — sections/images go
  // through their own endpoints below.
  async update(userId: string, entryId: string, dto: UpdateTimelineEntryDto) {
    const entry = await this.prisma.timelineEntry.findFirst({
      where: { id: entryId, tag: { ownerId: userId } },
    });
    // 404, not 403 — same ownership-hiding pattern used everywhere else in
    // this backend (Addresses/Reviews/NfcTag destination).
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    return this.prisma.timelineEntry.update({
      where: { id: entryId },
      data: {
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.occasion !== undefined ? { occasion: dto.occasion } : {}),
        ...(dto.entryDate ? { entryDate: new Date(dto.entryDate) } : {}),
      },
      include: SECTIONS_INCLUDE,
    });
  }

  // Deletes a day and every section/image under it — explicit ordered
  // deletes, not onDelete:Cascade, matching this backend's standing
  // convention (see Addresses' note on the same choice).
  async remove(userId: string, entryId: string) {
    const entry = await this.prisma.timelineEntry.findFirst({
      where: { id: entryId, tag: { ownerId: userId } },
      include: { sections: true },
    });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }
    const sectionIds = entry.sections.map((s) => s.id);
    await this.prisma.timelineImage.deleteMany({
      where: { sectionId: { in: sectionIds } },
    });
    await this.prisma.timelineSection.deleteMany({
      where: { entryId },
    });
    await this.prisma.timelineEntry.delete({ where: { id: entryId } });
  }

  async addSection(userId: string, entryId: string, dto: SectionInputDto) {
    const entry = await this.prisma.timelineEntry.findFirst({
      where: { id: entryId, tag: { ownerId: userId } },
      include: { sections: true },
    });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    return this.prisma.timelineSection.create({
      data: {
        entryId,
        ...this.sectionCreateData(dto, entry.sections.length),
      },
      include: { images: { orderBy: { order: 'asc' } } },
    });
  }

  async updateSection(
    userId: string,
    sectionId: string,
    dto: UpdateSectionDto,
  ) {
    const section = await this.prisma.timelineSection.findFirst({
      where: { id: sectionId, entry: { tag: { ownerId: userId } } },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    if (dto.images) {
      // Full replace — simplest correct way to support add/remove/reorder
      // from one submission, same convention as Product.images on update.
      await this.prisma.timelineImage.deleteMany({ where: { sectionId } });
    }

    return this.prisma.timelineSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.caption !== undefined ? { caption: dto.caption } : {}),
        ...(dto.images
          ? {
              images: {
                create: dto.images.map((image, i) => ({
                  url: image.url,
                  caption: image.caption,
                  order: i,
                })),
              },
            }
          : {}),
      },
      include: { images: { orderBy: { order: 'asc' } } },
    });
  }

  async removeSection(userId: string, sectionId: string) {
    const section = await this.prisma.timelineSection.findFirst({
      where: { id: sectionId, entry: { tag: { ownerId: userId } } },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    await this.prisma.timelineImage.deleteMany({ where: { sectionId } });
    await this.prisma.timelineSection.delete({ where: { id: sectionId } });
  }
}
