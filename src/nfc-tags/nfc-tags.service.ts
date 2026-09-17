import { randomInt } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DestinationKind,
  NfcTag,
  Prisma,
  StoryTheme,
  TagStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssignTagDto } from './dto/assign-tag.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';
import { UpdateDestinationKindDto } from './dto/update-destination-kind.dto';

// Excludes 0/O and 1/I/L — these get physically printed/engraved next to
// the chip, so visually-ambiguous characters would cause real mis-typed
// claims. 8 chars over this 32-letter alphabet is ~1.1 trillion combos —
// collisions inside one batch of a few hundred are effectively impossible,
// the retry-on-conflict below is just a backstop, not the real defense.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 8;
const MAX_GENERATE_ATTEMPTS = 5;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

@Injectable()
export class NfcTagsService {
  constructor(private prisma: PrismaService) {}

  // Admin/Manager — mints a batch of UNCLAIMED tags ahead of manufacturing.
  // The returned codes are what get exported and physically written onto
  // the NFC chips before those chips are fused into shirts.
  async bulkGenerate(count: number) {
    const tags: NfcTag[] = [];
    for (let i = 0; i < count; i++) {
      tags.push(await this.createUniqueTag());
    }
    return tags;
  }

  private async createUniqueTag(attempt = 0): Promise<NfcTag> {
    try {
      return await this.prisma.nfcTag.create({
        data: { code: generateCode() },
      });
    } catch (err) {
      if (isUniqueConstraintError(err) && attempt < MAX_GENERATE_ATTEMPTS) {
        return this.createUniqueTag(attempt + 1);
      }
      throw err;
    }
  }

  findAllForStaff(status?: TagStatus) {
    return this.prisma.nfcTag.findMany({
      where: status ? { status } : undefined,
      include: {
        orderItem: {
          include: {
            product: { select: { name: true } },
            order: {
              select: {
                id: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
        owner: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Fulfillment step: links one pre-generated tag to the one physical shirt
  // that's about to be packed for a specific sold order line.
  async assign(tagId: string, dto: AssignTagDto) {
    const tag = await this.prisma.nfcTag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    if (tag.status !== TagStatus.UNCLAIMED) {
      throw new BadRequestException(
        `Tag is already ${tag.status.toLowerCase()} — pick an unclaimed tag`,
      );
    }

    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: dto.orderItemId },
      include: { nfcTag: true },
    });
    if (!orderItem) {
      throw new NotFoundException('Order item not found');
    }
    if (orderItem.nfcTag) {
      throw new BadRequestException(
        'This order item already has a tag assigned',
      );
    }

    return this.prisma.nfcTag.update({
      where: { id: tagId },
      data: { status: TagStatus.ASSIGNED, orderItemId: orderItem.id },
    });
  }

  // Public — lightweight status lookup for the claim page (and, for a
  // Story-kind tag, the public /story/:code page itself). No PII beyond
  // the destination URL/garment — that's fine to return here since anyone
  // tapping the physical tag already gets redirected straight to this same
  // content via GET /t/:code, so this isn't disclosing anything new. Never
  // returns the linked order/owner.
  async findByCode(code: string) {
    const tag = await this.prisma.nfcTag.findUnique({
      where: { code },
      include: {
        destination: true,
        orderItem: { include: { product: true } },
      },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    return {
      code: tag.code,
      status: tag.status,
      destinationKind: tag.destinationKind,
      destinationUrl:
        tag.status === TagStatus.CLAIMED
          ? (tag.destination?.url ?? null)
          : null,
      story:
        tag.status === TagStatus.CLAIMED &&
        tag.destinationKind === DestinationKind.STORY
          ? {
              tagId: tag.id,
              theme: tag.storyTheme,
              product: tag.orderItem
                ? {
                    name: tag.orderItem.product.name,
                    images: tag.orderItem.product.images,
                    gsm: tag.orderItem.product.gsm,
                    fit: tag.orderItem.product.fit,
                  }
                : null,
            }
          : null,
    };
  }

  // Authenticated — ownership is "does this tag's linked order belong to
  // whoever's asking," derived straight from the JWT. No typed Order ID or
  // email needed: we already have the order on file via orderItem, and the
  // only thing left to check is whether it's this caller's own order.
  async claim(userId: string, code: string) {
    const tag = await this.prisma.nfcTag.findUnique({
      where: { code },
      include: { orderItem: { include: { order: true } } },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    if (tag.status === TagStatus.UNCLAIMED) {
      throw new BadRequestException('This tag isn’t linked to an order yet');
    }
    if (tag.status === TagStatus.CLAIMED) {
      throw new BadRequestException('This tag has already been claimed');
    }
    if (tag.orderItem?.order.userId !== userId) {
      throw new ForbiddenException(
        'This tag isn’t linked to any of your orders',
      );
    }

    return this.prisma.nfcTag.update({
      where: { id: tag.id },
      data: { status: TagStatus.CLAIMED, ownerId: userId },
    });
  }

  // Authenticated — the claim page's own pre-check: is this caller even
  // eligible to claim this tag (or, if they already own it, do they still
  // need to set a link) so the page can show the right state before they
  // commit anything. No side effects, safe to poll.
  async getClaimInfo(userId: string, code: string) {
    const tag = await this.prisma.nfcTag.findUnique({
      where: { code },
      include: {
        orderItem: { include: { order: true, product: true } },
        destination: true,
      },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    const ownedByMe =
      tag.status === TagStatus.CLAIMED && tag.ownerId === userId;
    const eligible =
      tag.status === TagStatus.ASSIGNED &&
      tag.orderItem?.order.userId === userId;
    // Three states an already-claimed owner can be in, so the claim page
    // knows exactly which step to resume on rather than re-litigating
    // ownership that's already settled:
    //  - never chose Link vs Story at all -> needsDestinationChoice
    //  - chose Link but never actually set a URL -> needsDestination
    //  - chose Story -> destinationKind/storyTheme tell the frontend to
    //    route straight to the story management screen (its own empty
    //    state handles "zero entries yet", no separate flag needed here).
    const needsDestinationChoice = ownedByMe && !tag.destinationKind;
    const needsDestination =
      ownedByMe &&
      tag.destinationKind === DestinationKind.LINK &&
      !tag.destination;

    return {
      id: tag.id,
      status: tag.status,
      eligible,
      needsDestinationChoice,
      needsDestination,
      destinationKind: ownedByMe ? tag.destinationKind : null,
      storyTheme: ownedByMe ? tag.storyTheme : null,
      product:
        (eligible || ownedByMe) && tag.orderItem
          ? {
              name: tag.orderItem.product.name,
              images: tag.orderItem.product.images,
              size: tag.orderItem.size,
              color: tag.orderItem.color,
            }
          : null,
    };
  }

  // Owner picks Link or Story right after claiming (or changes it later —
  // not blocked, matches this codebase's general "trust internal actors,
  // don't over-engineer state machines" stance, e.g. Order status updates).
  async setDestinationKind(
    userId: string,
    tagId: string,
    dto: UpdateDestinationKindDto,
  ) {
    const tag = await this.prisma.nfcTag.findFirst({
      where: { id: tagId, ownerId: userId },
    });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return this.prisma.nfcTag.update({
      where: { id: tagId },
      data: {
        destinationKind: dto.kind,
        storyTheme:
          dto.kind === DestinationKind.STORY
            ? (dto.theme ?? tag.storyTheme ?? StoryTheme.SUNSET_BLOOM)
            : tag.storyTheme,
      },
    });
  }

  findMine(userId: string) {
    return this.prisma.nfcTag.findMany({
      where: { ownerId: userId },
      include: {
        destination: true,
        orderItem: {
          select: {
            size: true,
            color: true,
            product: { select: { name: true, images: true, gsm: true, fit: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateDestination(
    userId: string,
    tagId: string,
    dto: UpdateDestinationDto,
  ) {
    const tag = await this.prisma.nfcTag.findFirst({
      where: { id: tagId, ownerId: userId },
    });
    // 404, not 403 — same "don't confirm existence of someone else's row"
    // pattern used for Addresses/Reviews.
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return this.prisma.destination.upsert({
      where: { tagId },
      create: { tagId, url: dto.url },
      update: { url: dto.url },
    });
  }

  // Used by the tap-redirect route — needs the destination URL only when
  // claimed, nothing else.
  findForRedirect(code: string) {
    return this.prisma.nfcTag.findUnique({
      where: { code },
      include: { destination: true },
    });
  }
}
