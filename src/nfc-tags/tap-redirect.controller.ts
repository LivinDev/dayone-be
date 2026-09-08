import { Controller, Get, Param, Redirect } from '@nestjs/common';
import { TagStatus } from '@prisma/client';
import { NfcTagsService } from './nfc-tags.service';

// This route is deliberately its own controller at the app root (`/t/:code`,
// not nested under `/nfc-tags`) so a physical tag's permanent URL stays
// short. It must be reachable directly — in production, whatever reverse
// proxy sits in front of this API needs to route `/t/*` straight to this
// NestJS app rather than through the Next.js frontend, or this never fires.
@Controller('t')
export class TapRedirectController {
  constructor(private nfcTagsService: NfcTagsService) {}

  @Get(':code')
  @Redirect()
  async tap(@Param('code') code: string) {
    // Read lazily, per-request — not as a module-level constant. TS compiles
    // this file's imports into requires hoisted above main.ts's
    // process.loadEnvFile('.env') call, so a module-level `process.env` read
    // here would always see undefined and silently lock in the fallback for
    // the process's whole lifetime, regardless of what .env actually says
    // (the same class of bug already hit once with JwtModule.register()).
    const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';

    const tag = await this.nfcTagsService.findForRedirect(code);

    // An unknown code (typo during writing, an orphaned/miswritten chip)
    // degrades to the homepage rather than a bare 404 — a customer standing
    // there with a shirt shouldn't hit a dead-looking error page.
    if (!tag) {
      return { url: frontendOrigin, statusCode: 302 };
    }

    if (tag.status === TagStatus.CLAIMED && tag.destination) {
      return { url: tag.destination.url, statusCode: 302 };
    }

    // Not yet claimed, or (edge case) claimed with no destination set yet —
    // either way `/claim/:code` on the frontend is the right landing spot:
    // it does its own by-code lookup and shows the right state (a claimed
    // tag with no link yet doesn't need to re-prove ownership through a
    // form, it just hasn't had a link added).
    return { url: `${frontendOrigin}/claim/${tag.code}`, statusCode: 302 };
  }
}
