import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TrimmedEmail } from '../../common/decorators/trimmed-email.decorator';

// The "tag my own garment" retrofit service's intake form. No price field —
// the fee is a fixed server-side constant (see GarmentTagRequestsService),
// never trusted from the client, same rule Orders already follows for money.
export class CreateGarmentTagRequestDto {
  @IsString()
  @MinLength(1)
  garmentPhotoUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  garmentNote?: string;

  // Normalized fractions (0-1) of the photo's width/height, not pixels — see
  // the schema comment on GarmentTagRequest.markerX for why.
  @IsNumber()
  @Min(0)
  @Max(1)
  markerX: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  markerY: number;

  @IsString()
  @MinLength(1)
  contactName: string;

  @IsString()
  @MinLength(1)
  contactPhone: string;

  @TrimmedEmail()
  contactEmail: string;

  @IsString()
  @MinLength(1)
  pickupLine1: string;

  @IsOptional()
  @IsString()
  pickupLine2?: string;

  @IsString()
  @MinLength(1)
  pickupCity: string;

  @IsString()
  @MinLength(1)
  pickupState: string;

  @Matches(/^\d{6}$/, { message: 'pincode must be a 6-digit Indian PIN code' })
  pickupPincode: string;

  // Only present if the customer used "Use My Current Location" — optional,
  // never blocks submission.
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng?: number;
}
