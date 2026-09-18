import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { GarmentTagRequestStatus, TagStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { compressImage } from '../common/utils/image-processing.util';
import { CreateGarmentTagRequestDto } from './dto/create-garment-tag-request.dto';
import { UpdateGarmentTagRequestDto } from './dto/update-garment-tag-request.dto';

// Fixed cash-on-pickup/drop-off fee — never trusted from the client, same
// "money is server-computed, not client-supplied" rule Orders follows.
// Real value confirmed with the founder 2026-09-17; change only here if it
// ever changes, nothing else hardcodes it.
export const GARMENT_TAG_FEE_PAISE = 29_900; // ₹299

const STAFF_LIST_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
  nfcTag: { select: { id: true, code: true, status: true } },
};

@Injectable()
export class GarmentTagRequestsService {
  constructor(private prisma: PrismaService) {}

  // Lazy — same pattern as every other upload endpoint in this backend
  // (Products/Timeline) so the app still boots without AWS_* env vars set.
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
    const baseName = file.originalname
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-');
    const key = `garment-tag-requests/${randomUUID()}-${baseName}.${compressed.extension}`;
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

  create(userId: string, dto: CreateGarmentTagRequestDto) {
    return this.prisma.garmentTagRequest.create({
      data: {
        userId,
        garmentPhotoUrl: dto.garmentPhotoUrl,
        garmentNote: dto.garmentNote,
        markerX: dto.markerX,
        markerY: dto.markerY,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        pickupLine1: dto.pickupLine1,
        pickupLine2: dto.pickupLine2,
        pickupCity: dto.pickupCity,
        pickupState: dto.pickupState,
        pickupPincode: dto.pickupPincode,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        feeInPaise: GARMENT_TAG_FEE_PAISE,
      },
    });
  }

  findMine(userId: string) {
    return this.prisma.garmentTagRequest.findMany({
      where: { userId },
      include: { nfcTag: { select: { id: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllForStaff(status?: GarmentTagRequestStatus) {
    return this.prisma.garmentTagRequest.findMany({
      where: status ? { status } : undefined,
      include: STAFF_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForStaff(id: string) {
    const request = await this.prisma.garmentTagRequest.findUnique({
      where: { id },
      include: STAFF_LIST_INCLUDE,
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    return request;
  }

  async updateForStaff(id: string, dto: UpdateGarmentTagRequestDto) {
    const request = await this.prisma.garmentTagRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Installing the tag is the one transition with real side effects: it
    // links a physical NfcTag and hands ownership straight to the
    // requester. No separate claim step — we already know exactly who this
    // is, unlike a purchased garment where a stranger could otherwise pack
    // the shirt.
    if (dto.status === GarmentTagRequestStatus.TAG_INSTALLED) {
      if (request.status === GarmentTagRequestStatus.TAG_INSTALLED) {
        throw new BadRequestException('This request already has a tag installed');
      }
      if (!dto.tagId) {
        throw new BadRequestException(
          'Pick an unclaimed tag to install before marking this TAG_INSTALLED',
        );
      }
      const tag = await this.prisma.nfcTag.findUnique({
        where: { id: dto.tagId },
      });
      if (!tag) {
        throw new BadRequestException('That tag doesn’t exist');
      }
      if (tag.status !== TagStatus.UNCLAIMED) {
        throw new BadRequestException(
          `Tag ${tag.code} is already ${tag.status.toLowerCase()} — pick an unclaimed tag`,
        );
      }

      const [, updatedRequest] = await this.prisma.$transaction([
        this.prisma.nfcTag.update({
          where: { id: tag.id },
          data: {
            status: TagStatus.CLAIMED,
            ownerId: request.userId,
            tagInstallRequestId: request.id,
          },
        }),
        this.prisma.garmentTagRequest.update({
          where: { id },
          data: {
            status: GarmentTagRequestStatus.TAG_INSTALLED,
            ...(dto.staffNotes !== undefined ? { staffNotes: dto.staffNotes } : {}),
          },
        }),
      ]);
      return updatedRequest;
    }

    return this.prisma.garmentTagRequest.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.staffNotes !== undefined ? { staffNotes: dto.staffNotes } : {}),
      },
    });
  }
}
