import { IsUrl } from 'class-validator';

export class UpdateDestinationDto {
  @IsUrl({ require_protocol: true })
  url: string;
}
