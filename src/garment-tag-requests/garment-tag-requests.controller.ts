import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role, GarmentTagRequestStatus } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { GarmentTagRequestsService } from './garment-tag-requests.service';
import { CreateGarmentTagRequestDto } from './dto/create-garment-tag-request.dto';
import { UpdateGarmentTagRequestDto } from './dto/update-garment-tag-request.dto';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — same cap as Products'/Timeline's uploaders

@Controller('garment-tag-requests')
export class GarmentTagRequestsController {
  constructor(private garmentTagRequestsService: GarmentTagRequestsService) {}

  // Authenticated (any role) — a customer uploading a photo of their own
  // garment, not staff managing the catalog.
  @Post('uploads')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.garmentTagRequestsService.uploadImage(file);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGarmentTagRequestDto,
  ) {
    return this.garmentTagRequestsService.create(user.userId, dto);
  }

  // Authenticated — the requester's own submissions, for Account Home's
  // "Tag My Garment" tab.
  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.garmentTagRequestsService.findMine(user.userId);
  }

  // Admin/Manager — the pickup/install queue. Declared before `admin/:id`
  // below, same route-ordering convention as Products/Orders/NfcTags.
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  findAllForStaff(@Query('status') status?: GarmentTagRequestStatus) {
    return this.garmentTagRequestsService.findAllForStaff(status);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  findOneForStaff(@Param('id') id: string) {
    return this.garmentTagRequestsService.findOneForStaff(id);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  updateForStaff(
    @Param('id') id: string,
    @Body() dto: UpdateGarmentTagRequestDto,
  ) {
    return this.garmentTagRequestsService.updateForStaff(id, dto);
  }
}
