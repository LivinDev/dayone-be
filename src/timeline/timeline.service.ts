import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { EntryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimelineEntryDto } from './dto/create-timeline-entry.dto';
import { UpdateTimelineEntryDto } from './dto/update-timeline-entry.dto';

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

    const key = `timeline/${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
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
    });
  }

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
        images: dto.images,
        caption: dto.caption,
        location: dto.location,
        ...(dto.entryDate ? { entryDate: new Date(dto.entryDate) } : {}),
      },
    });
  }

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
        ...(dto.images ? { images: dto.images } : {}),
        ...(dto.caption !== undefined ? { caption: dto.caption } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.entryDate ? { entryDate: new Date(dto.entryDate) } : {}),
      },
    });
  }

  async remove(userId: string, entryId: string) {
    const entry = await this.prisma.timelineEntry.findFirst({
      where: { id: entryId, tag: { ownerId: userId } },
    });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }
    await this.prisma.timelineEntry.delete({ where: { id: entryId } });
  }
}
