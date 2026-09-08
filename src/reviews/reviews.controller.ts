import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Controller()
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  // Public — anyone can read a product's reviews.
  @Get('products/:productId/reviews')
  findAllForProduct(@Param('productId') productId: string) {
    return this.reviewsService.findAllForProduct(productId);
  }

  // Authenticated — lets the frontend decide whether to show the review
  // form at all. Not authoritative on its own; create() below re-checks.
  @Get('products/:productId/reviews/eligibility')
  @UseGuards(JwtAuthGuard)
  checkEligibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
  ) {
    return this.reviewsService.checkEligibility(user.userId, productId);
  }

  @Post('products/:productId/reviews')
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId') productId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user.userId, productId, dto);
  }

  @Patch('reviews/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(user.userId, id, dto);
  }

  @Delete('reviews/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reviewsService.remove(user.userId, id);
  }
}
