import { Controller, Get, Param, Redirect } from '@nestjs/common';
import { TagStatus } from '@prisma/client';
import { NfcTagsService } from './nfc-tags.service';

// The frontend origin a code degrades to when nothing better is known — the
// homepage, not a bare error page. A tap that lands on a real (if generic)
// page reads as "huh, weird" rather than "this brand's tech is broken."
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';

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
    const tag = await this.nfcTagsService.findForRedirect(code);

    // An unknown code (typo during writing, an orphaned/miswritten chip)
    // degrades to the homepage rather than a bare 404 — a customer standing
    // there with a shirt shouldn't hit a dead-looking error page.
    if (!tag) {
      return { url: FRONTEND_ORIGIN, statusCode: 302 };
    }

    if (tag.status === TagStatus.CLAIMED && tag.destination) {
      return { url: tag.destination.url, statusCode: 302 };
    }

    // Not yet claimed, or (edge case) claimed with no destination set yet —
    // either way `/claim/:code` on the frontend is the right landing spot:
    // it does its own by-code lookup and shows the right state (a claimed
    // tag with no link yet doesn't need to re-prove ownership through a
    // form, it just hasn't had a link added).
    return { url: `${FRONTEND_ORIGIN}/claim/${tag.code}`, statusCode: 302 };
  }
}
