import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

const REVIEW_AUTHOR_SELECT = { user: { select: { name: true } } } as const;

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async findAllForProduct(productId: string) {
    const [reviews, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        include: REVIEW_AUTHOR_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    return {
      reviews,
      averageRating: aggregate._avg.rating ?? 0,
      count: aggregate._count,
    };
  }

  // Whether `userId` is currently eligible to review `productId` — a real
  // non-cancelled order containing it, not delivery status (nothing in this
  // system ever marks an order DELIVERED yet). Used by the frontend to
  // decide whether to show the review form at all; `create()` below
  // re-checks this independently and is the actual authority.
  async checkEligibility(userId: string, productId: string) {
    const [hasPurchased, existingReview] = await Promise.all([
      this.prisma.orderItem.findFirst({
        where: { productId, order: { userId, status: { not: 'CANCELLED' } } },
      }),
      this.prisma.review.findUnique({
        where: { userId_productId: { userId, productId } },
      }),
    ]);
    return {
      canReview: !!hasPurchased && !existingReview,
      hasReviewed: !!existingReview,
    };
  }

  async create(userId: string, productId: string, dto: CreateReviewDto) {
    const existing = await this.prisma.review.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) {
      throw new ConflictException(
        "You've already reviewed this product — edit your existing review instead",
      );
    }

    // The actual authority on eligibility — never trust a client's claim
    // that they're allowed to review something.
    const qualifyingOrderItem = await this.prisma.orderItem.findFirst({
      where: { productId, order: { userId, status: { not: 'CANCELLED' } } },
      orderBy: { id: 'desc' },
    });
    if (!qualifyingOrderItem) {
      throw new ForbiddenException(
        "You can only review products you've purchased",
      );
    }

    return this.prisma.review.create({
      data: {
        productId,
        userId,
        orderId: qualifyingOrderItem.orderId,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: REVIEW_AUTHOR_SELECT,
    });
  }

  async update(userId: string, id: string, dto: UpdateReviewDto) {
    await this.findOwnedOrThrow(userId, id);
    return this.prisma.review.update({
      where: { id },
      data: dto,
      include: REVIEW_AUTHOR_SELECT,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOwnedOrThrow(userId, id);
    await this.prisma.review.delete({ where: { id } });
  }

  private async findOwnedOrThrow(userId: string, id: string) {
    const review = await this.prisma.review.findFirst({
      where: { id, userId },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }
}
