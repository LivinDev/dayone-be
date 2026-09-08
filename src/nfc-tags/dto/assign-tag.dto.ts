import { IsString, MinLength } from 'class-validator';

export class AssignTagDto {
  @IsString()
  @MinLength(1)
  orderItemId: string;
}
