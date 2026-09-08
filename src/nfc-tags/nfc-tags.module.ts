import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { NfcTagsController } from './nfc-tags.controller';
import { TapRedirectController } from './tap-redirect.controller';
import { NfcTagsService } from './nfc-tags.service';

@Module({
  // Only POST /nfc-tags/claim actually applies ThrottlerGuard (see the
  // controller) — importing this here scopes the rate-limit storage/config
  // to this module rather than throttling every route in the app.
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
  controllers: [NfcTagsController, TapRedirectController],
  providers: [NfcTagsService],
})
export class NfcTagsModule {}
