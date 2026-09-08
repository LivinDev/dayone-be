import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { VariantsService } from './variants.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';

// Nested under /products/:productId for creation, flat /variants/:id for
// update/delete (mirrors how the resource is addressed once it exists —
// same shape as most REST APIs with a child resource).
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class VariantsController {
  constructor(private variantsService: VariantsService) {}

  @Post('products/:productId/variants')
  create(@Param('productId') productId: string, @Body() dto: CreateVariantDto) {
    return this.variantsService.create(productId, dto);
  }

  @Patch('variants/:id')
  update(@Param('id') id: string, @Body() dto: UpdateVariantDto) {
    return this.variantsService.update(id, dto);
  }

  @Delete('variants/:id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.variantsService.remove(id);
  }
}
