import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TimelineService } from './timeline.service';
import { CreateTimelineEntryDto } from './dto/create-timeline-entry.dto';
import { UpdateTimelineEntryDto } from './dto/update-timeline-entry.dto';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — same cap as Products' uploader

@Controller()
export class TimelineController {
  constructor(private timelineService: TimelineService) {}

  // Authenticated (any role) — not Admin/Manager-only like Products'
  // uploader, since this is an owner uploading to their own story, not
  // staff managing the catalog.
  @Post('timeline/uploads')
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
    return this.timelineService.uploadImage(file);
  }

  // Public — the eventual /story/:code page reads through this.
  @Get('nfc-tags/:tagId/timeline')
  findPublic(@Param('tagId') tagId: string) {
    return this.timelineService.findPublicForTag(tagId);
  }

  // Owner-only — the story management screen's own list (sees everything,
  // not just approved, though that's a no-op until moderation exists).
  @Get('nfc-tags/:tagId/timeline/mine')
  @UseGuards(JwtAuthGuard)
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tagId') tagId: string,
  ) {
    return this.timelineService.findMineForTag(user.userId, tagId);
  }

  @Post('nfc-tags/:tagId/timeline')
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tagId') tagId: string,
    @Body() dto: CreateTimelineEntryDto,
  ) {
    return this.timelineService.create(user.userId, tagId, dto);
  }

  @Patch('timeline/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTimelineEntryDto,
  ) {
    return this.timelineService.update(user.userId, id, dto);
  }

  @Delete('timeline/:id')
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.timelineService.remove(user.userId, id);
  }
}
