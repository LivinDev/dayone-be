import { IsString, MinLength } from 'class-validator';

// Ownership used to be proven with a typed Order ID + email — that made
// sense for an anonymous claim page, but the frontend now requires login
// first, so ownership is just "does this tag's order belong to whoever's
// making this request," derived from the JWT, not typed in.
export class ClaimTagDto {
  @IsString()
  @MinLength(1)
  code: string;
}
