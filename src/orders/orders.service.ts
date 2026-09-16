import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { getSellerConfig } from '../common/config/seller-config';

// Product prices are shown to customers as tax-inclusive ("Taxes Included"
// on Cart/Product Detail) — so priceInPaise already has GST baked in. GST
// here is *carved out* of that total for the legally-required CGST/SGST/IGST
// breakdown, never added on top (that would silently overcharge beyond what
// the customer was shown).
const GST_RATE = 0.12;

// Cotton T-shirts/vests, knitted — standard HSN chapter 61 code for this
// catalog (Day01 sells only heavyweight tees right now).
const HSN_CODE = '6109';

function normalizeState(state: string) {
  return state.trim().toLowerCase();
}

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: { include: { product: true, variant: true } },
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: { include: { product: true, variant: true } },
        invoice: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  // Admin/Manager — every order, across every customer. No pagination yet;
  // fine at this project's order volume (a 20-50 piece batch), revisit if
  // that ever stops being true.
  findAllForStaff() {
    return this.prisma.order.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: true, variant: true, nfcTag: true } },
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForStaff(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: true, variant: true, nfcTag: true } },
        invoice: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto) {
    await this.findOneForStaff(orderId);
    return this.prisma.order.update({
      where: { id: orderId },
      data: dto,
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: true, variant: true, nfcTag: true } },
        invoice: true,
      },
    });
  }

  async create(userId: string, dto: CreateOrderDto) {
    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Two supported item shapes: a real `variantId` (real color/size/stock),
    // or the legacy `productId`+`size` shape for products that don't have
    // real variants set up yet — kept alive deliberately so existing
    // products stay orderable until the founder adds real variants for
    // them, rather than breaking checkout for the whole catalog overnight.
    const variantLines = dto.items.filter((item) => item.variantId);
    const legacyLines = dto.items.filter((item) => !item.variantId);
    for (const line of legacyLines) {
      if (!line.productId || !line.size) {
        throw new BadRequestException(
          'Each item needs either a variantId, or a productId and size',
        );
      }
    }

    const orderItemsData: {
      productId: string;
      variantId: string | null;
      priceInPaise: number;
      size: string;
      color: string | null;
    }[] = [];

    // --- Real variant lines: real stock check, real decrement later. ---
    const variantIds = [
      ...new Set(variantLines.map((item) => item.variantId as string)),
    ];
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });
    const variantById = new Map(variants.map((v) => [v.id, v]));
    const neededByVariant = new Map<string, number>();

    for (const line of variantLines) {
      const variant = variantById.get(line.variantId as string);
      if (!variant || !variant.product.active) {
        throw new BadRequestException(
          `Variant ${line.variantId} is unavailable`,
        );
      }
      neededByVariant.set(
        variant.id,
        (neededByVariant.get(variant.id) ?? 0) + line.quantity,
      );
      const totalNeeded = neededByVariant.get(variant.id) as number;
      if (variant.stockQuantity < totalNeeded) {
        const label = [variant.color, variant.size].filter(Boolean).join(' / ');
        throw new BadRequestException(
          `Only ${variant.stockQuantity} left in stock for ${variant.product.name} (${label})`,
        );
      }

      const priceInPaise = variant.priceInPaise ?? variant.product.priceInPaise;
      for (let i = 0; i < line.quantity; i++) {
        orderItemsData.push({
          productId: variant.productId,
          variantId: variant.id,
          priceInPaise,
          size: variant.size,
          color: variant.color,
        });
      }
    }

    // --- Legacy lines: no stock tracking, same as before variants existed.
    // Rejected once a product actually has real variants — customers must
    // go through those so stock stays accurate. ---
    const legacyProductIds = [
      ...new Set(legacyLines.map((item) => item.productId as string)),
    ];
    const legacyProducts = await this.prisma.product.findMany({
      where: { id: { in: legacyProductIds } },
      include: { variants: true },
    });
    const legacyProductById = new Map(legacyProducts.map((p) => [p.id, p]));

    for (const line of legacyLines) {
      const product = legacyProductById.get(line.productId as string);
      if (!product || !product.active) {
        throw new BadRequestException(
          `Product ${line.productId} is unavailable`,
        );
      }
      if (product.variants.length > 0) {
        throw new BadRequestException(
          `${product.name} now has real sizes — please select one and try again`,
        );
      }
      for (let i = 0; i < line.quantity; i++) {
        orderItemsData.push({
          productId: product.id,
          variantId: null,
          priceInPaise: product.priceInPaise,
          size: line.size as string,
          color: null,
        });
      }
    }

    const totalInPaise = orderItemsData.reduce(
      (sum, item) => sum + item.priceInPaise,
      0,
    );

    // GST is included in the price shown, so it's reverse-computed out of
    // the tax-inclusive total: gst = total * rate / (1 + rate).
    const gstAmountInPaise = Math.round(
      (totalInPaise * GST_RATE) / (1 + GST_RATE),
    );
    const sameState =
      normalizeState(address.state) === normalizeState(getSellerConfig().state);
    const cgstInPaise = sameState ? Math.round(gstAmountInPaise / 2) : 0;
    const sgstInPaise = sameState ? gstAmountInPaise - cgstInPaise : 0;
    const igstInPaise = sameState ? 0 : gstAmountInPaise;

    return this.prisma.$transaction(async (tx) => {
      // Atomic decrement guarded by a stock>=needed WHERE clause, so two
      // concurrent checkouts can't both succeed past the same last unit —
      // updateMany's affected-row count tells us if the guard held.
      for (const [variantId, needed] of neededByVariant) {
        const result = await tx.productVariant.updateMany({
          where: { id: variantId, stockQuantity: { gte: needed } },
          data: { stockQuantity: { decrement: needed } },
        });
        if (result.count === 0) {
          throw new BadRequestException(
            'One of the items in your bag just sold out — please review your bag',
          );
        }
      }

      const order = await tx.order.create({
        data: {
          userId,
          status: 'CONFIRMED', // no payment gateway step to wait on for COD
          paymentStatus: 'PENDING', // COD is collected on delivery, not at order time
          shippingAddress: {
            label: address.label,
            fullName: address.fullName,
            phone: address.phone,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            country: address.country,
          },
          totalInPaise,
          gstAmountInPaise,
          items: { create: orderItemsData },
        },
        include: { items: { include: { product: true, variant: true } } },
      });

      const invoiceNumber = await this.nextInvoiceNumber(tx, order.createdAt);
      const invoice = await tx.invoice.create({
        data: {
          orderId: order.id,
          invoiceNumber,
          cgstInPaise,
          sgstInPaise,
          igstInPaise,
          hsnCode: HSN_CODE,
        },
      });

      return { ...order, invoice };
    });
  }

  // Sequential per Indian financial year (Apr-Mar), e.g. DAY01/2026/0001.
  // Count-based within a transaction — fine at this project's order volume;
  // a dedicated counter table would be needed if concurrent checkouts ever
  // become common enough to race on this count.
  private async nextInvoiceNumber(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    orderDate: Date,
  ) {
    const fyStartYear =
      orderDate.getMonth() >= 3
        ? orderDate.getFullYear()
        : orderDate.getFullYear() - 1;
    const prefix = `DAY01/${fyStartYear}/`;
    const countThisFY = await tx.invoice.count({
      where: { invoiceNumber: { startsWith: prefix } },
    });
    const sequence = String(countThisFY + 1).padStart(4, '0');
    return `${prefix}${sequence}`;
  }
}
