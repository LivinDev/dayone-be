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
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  // Public — Home/Collection listing. Optional ?category=<slug> filter
  // (a real Category's slug now, not a fixed enum value — an unknown slug
  // just yields an empty list, same as any other non-matching filter).
  @Get()
  findAll(@Query('category') category?: string) {
    return this.productsService.findAllActive(category);
  }

  // Admin/Manager — dashboard listing, includes deactivated products.
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  findAllForStaff() {
    return this.productsService.findAllForStaff();
  }

  // Admin/Manager — fetch one by id (incl. deactivated) for the edit form,
  // e.g. on a direct link/refresh where the list's data isn't in memory.
  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  findOneForStaff(@Param('id') id: string) {
    return this.productsService.findOneForStaff(id);
  }

  // Admin/Manager — uploads one image to S3, returns its public URL. The
  // create/update endpoints below still just take `images: string[]`; this
  // is how the admin UI gets a real URL to put in that array.
  @Post('uploads')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
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
    return this.productsService.uploadImage(file);
  }

  // Public — Product Detail page.
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }
}
