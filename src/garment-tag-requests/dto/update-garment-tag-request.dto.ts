import { IsEnum, IsOptional, IsString } from 'class-validator';
import { GarmentTagRequestStatus } from '@prisma/client';

// Admin/Manager only. No state-machine enforcement, same deliberately
// simple stance as UpdateOrderStatusDto — staff are trusted to set this
// correctly at this project's scale.
export class UpdateGarmentTagRequestDto {
  @IsOptional()
  @IsEnum(GarmentTagRequestStatus)
  status?: GarmentTagRequestStatus;

  @IsOptional()
  @IsString()
  staffNotes?: string;

  // Only meaningful (and required, checked in the service) when `status` is
  // being set to TAG_INSTALLED — the UNCLAIMED tag id staff picked (same
  // `tagId` shape Order Detail's own NfcTagCell/assignTag already use) to
  // fuse into this garment.
  @IsOptional()
  @IsString()
  tagId?: string;
}
