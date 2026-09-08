import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// Either a real `variantId` (products with real color/size/stock set up), or
// the legacy `productId`+`size` shape (products with zero variants yet —
// see OrdersService for why this path still exists and when it's rejected).
class OrderItemInputDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  variantId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  productId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  size?: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

// Money and per-line pricing are never taken from the client — the service
// re-fetches each variant's (or product's) real priceInPaise, and re-checks
// stock server-side, ignoring anything a request body claims.
export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  addressId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];
}
