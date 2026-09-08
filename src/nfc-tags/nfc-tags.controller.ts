import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Role, TagStatus } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { NfcTagsService } from './nfc-tags.service';
import { BulkGenerateTagsDto } from './dto/bulk-generate-tags.dto';
import { AssignTagDto } from './dto/assign-tag.dto';
import { ClaimTagDto } from './dto/claim-tag.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';

@Controller('nfc-tags')
export class NfcTagsController {
  constructor(private nfcTagsService: NfcTagsService) {}

  // Admin/Manager — mint a batch of tags ahead of manufacturing.
  @Post('admin/bulk-generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  bulkGenerate(@Body() dto: BulkGenerateTagsDto) {
    return this.nfcTagsService.bulkGenerate(dto.count);
  }

  // Admin/Manager — full tag list for the dashboard, optionally filtered.
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  findAllForStaff(@Query('status') status?: TagStatus) {
    return this.nfcTagsService.findAllForStaff(status);
  }

  // Admin/Manager — fulfillment step: link a specific tag to the specific
  // order line about to be packed.
  @Patch('admin/:id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  assign(@Param('id') id: string, @Body() dto: AssignTagDto) {
    return this.nfcTagsService.assign(id, dto);
  }

  // Public — the claim page uses this to know what state a code is in
  // before deciding whether to show a login prompt, the claim form, or
  // redirect straight through to an already-claimed destination.
  @Get('by-code/:code')
  findByCode(@Param('code') code: string) {
    return this.nfcTagsService.findByCode(code);
  }

  // Authenticated — the claim form's pre-check: is the logged-in caller
  // actually eligible to claim this tag, and if so, what garment is it.
  @Get('claim-info/:code')
  @UseGuards(JwtAuthGuard)
  getClaimInfo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
  ) {
    return this.nfcTagsService.getClaimInfo(user.userId, code);
  }

  // Authenticated — ownership is derived from the JWT (does this tag's
  // order belong to whoever's asking), not a typed Order ID/email. Still
  // rate-limited: cheap insurance against scripted claim attempts even
  // though the account itself is already the real gate.
  @Post('claim')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  claim(@CurrentUser() user: AuthenticatedUser, @Body() dto: ClaimTagDto) {
    return this.nfcTagsService.claim(user.userId, dto.code);
  }

  // Authenticated — the owner's own claimed tags, for Account Home's
  // "NFC & Garments" tab.
  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.nfcTagsService.findMine(user.userId);
  }

  // Authenticated — set/update where a claimed tag redirects to.
  @Patch(':id/destination')
  @UseGuards(JwtAuthGuard)
  updateDestination(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDestinationDto,
  ) {
    return this.nfcTagsService.updateDestination(user.userId, id, dto);
  }
}
