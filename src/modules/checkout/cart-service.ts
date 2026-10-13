import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import type { DbOrTx } from '@/lib/db';
import { carts, cartItems } from '@/lib/db/schema/orders';
import { productVariants, products, productImages } from '@/lib/db/schema/catalog';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { generateId } from '@/lib/utils';

/**
 * Cart line item summary with live catalog pricing snapshots.
 */
export interface CartItemSummary {
  id: string;
  variantId: string;
  productId: string;
  productTitle: string;
  variantName: string | null;
  sku: string;
  quantity: number;
  unitPrice: number; // Server-authoritative unit price in minor units
  lineTotal: number; // unitPrice * quantity
  imageUrl: string | null;
  stockAvailable: number;
}

/**
 * Overall cart summary evaluated on server.
 */
export interface CartSummary {
  cartId: string;
  sessionId: string;
  customerId: string | null;
  items: CartItemSummary[];
  itemCount: number;
  subtotal: number; // In minor units
  currency: string;
  expiresAt: Date;
}

/**
 * Expiration duration for shopping carts (7 days).
 */
export const CART_EXPIRY_DAYS = 7;

/**
 * Calculates cart expiration timestamp (7 days from now).
 */
export function calculateCartExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + CART_EXPIRY_DAYS);
  return d;
}

/**
 * Retrieves an active cart or creates a new one for the session/customer within tenant.
 * Automatically clears and resets expired carts (> 7 days).
 *
 * @param tenantId - Tenant identifier
 * @param sessionId - Storefront session token/identifier
 * @param customerId - Optional customer ID
 * @param tx - Optional transaction handle
 */
export async function getOrCreateCart(
  tenantId: string,
  sessionId: string,
  customerId?: string,
  tx?: DbOrTx
) {
  const executor = tx ?? db;

  if (!tenantId || !sessionId) {
    throw new ValidationError('Tenant ID and session ID are required');
  }

  const existingCart = await executor.query.carts.findFirst({
    where: and(
      eq(carts.tenantId, tenantId),
      eq(carts.sessionId, sessionId)
    ),
  });

  const now = new Date();

  if (existingCart) {
    // If cart has expired, delete its items and refresh expiration date
    if (new Date(existingCart.expiresAt) <= now) {
      await executor
        .delete(cartItems)
        .where(
          and(
            eq(cartItems.tenantId, tenantId),
            eq(cartItems.cartId, existingCart.id)
          )
        );

      const newExpiry = calculateCartExpiry();
      const [refreshed] = await executor
        .update(carts)
        .set({
          expiresAt: newExpiry,
          customerId: customerId ?? existingCart.customerId,
          updatedAt: now,
        })
        .where(
          and(
            eq(carts.tenantId, tenantId),
            eq(carts.id, existingCart.id)
          )
        )
        .returning();

      return refreshed;
    }

    // Cart is still valid, update customerId if now authenticated
    if (customerId && existingCart.customerId !== customerId) {
      const [updated] = await executor
        .update(carts)
        .set({
          customerId,
          updatedAt: now,
        })
        .where(
          and(
            eq(carts.tenantId, tenantId),
            eq(carts.id, existingCart.id)
          )
        )
        .returning();
      return updated;
    }

    return existingCart;
  }

  // Create new cart
  const newCartId = generateId();
  const expiresAt = calculateCartExpiry();

  const [created] = await executor
    .insert(carts)
    .values({
      id: newCartId,
      tenantId,
      sessionId,
      customerId: customerId ?? null,
      expiresAt,
    })
    .returning();

  return created;
}

/**
 * Adds an item to the shopping cart after verifying tenant scope, variant active status, and stock availability.
 *
 * @param tenantId - Tenant identifier
 * @param sessionId - Session identifier
 * @param variantId - Product variant identifier
 * @param quantity - Desired addition quantity (positive integer)
 * @param tx - Optional transaction handle
 */
export async function addItemToCart(
  tenantId: string,
  sessionId: string,
  variantId: string,
  quantity: number,
  tx?: DbOrTx
) {
  if (quantity <= 0 || !Number.isInteger(quantity)) {
    throw new ValidationError('Quantity must be a positive integer', [
      { field: 'quantity', message: 'Quantity must be at least 1' },
    ]);
  }

  const executor = tx ?? db;

  // 1. Get or create active cart
  const cart = await getOrCreateCart(tenantId, sessionId, undefined, executor);

  // 2. Fetch variant and verify tenant isolation and active status
  const variant = await executor.query.productVariants.findFirst({
    where: and(
      eq(productVariants.tenantId, tenantId),
      eq(productVariants.id, variantId)
    ),
    with: {
      product: true,
    },
  });

  if (!variant || !variant.product || variant.product.tenantId !== tenantId) {
    throw new NotFoundError(`Product variant '${variantId}' not found for this store`);
  }

  if (!variant.isActive || variant.product.status !== 'active') {
    throw new ValidationError('Product variant is currently not available for purchase');
  }

  // 3. Check existing quantity in cart
  const existingCartItem = await executor.query.cartItems.findFirst({
    where: and(
      eq(cartItems.tenantId, tenantId),
      eq(cartItems.cartId, cart.id),
      eq(cartItems.variantId, variantId)
    ),
  });

  const totalRequested = (existingCartItem ? existingCartItem.quantity : 0) + quantity;

  if (variant.stockQuantity < totalRequested) {
    throw new ValidationError(
      `Insufficient stock. Available: ${variant.stockQuantity}, Requested: ${totalRequested}`,
      [{ field: 'quantity', message: `Only ${variant.stockQuantity} units available in stock` }]
    );
  }

  // 4. Insert or update cart item
  if (existingCartItem) {
    const [updated] = await executor
      .update(cartItems)
      .set({
        quantity: totalRequested,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cartItems.tenantId, tenantId),
          eq(cartItems.id, existingCartItem.id)
        )
      )
      .returning();
    return updated;
  }

  const [inserted] = await executor
    .insert(cartItems)
    .values({
      id: generateId(),
      tenantId,
      cartId: cart.id,
      variantId,
      quantity,
    })
    .returning();

  return inserted;
}

/**
 * Updates quantity of a specific cart item.
 * If quantity is 0 or less, removes the item.
 *
 * @param tenantId - Tenant identifier
 * @param sessionId - Session identifier
 * @param cartItemId - Cart item ID
 * @param quantity - New quantity
 * @param tx - Optional transaction handle
 */
export async function updateCartItem(
  tenantId: string,
  sessionId: string,
  cartItemId: string,
  quantity: number,
  tx?: DbOrTx
) {
  const executor = tx ?? db;

  if (quantity <= 0) {
    return removeItemFromCart(tenantId, sessionId, cartItemId, executor);
  }

  if (!Number.isInteger(quantity)) {
    throw new ValidationError('Quantity must be an integer');
  }

  const cart = await getOrCreateCart(tenantId, sessionId, undefined, executor);

  const cartItem = await executor.query.cartItems.findFirst({
    where: and(
      eq(cartItems.tenantId, tenantId),
      eq(cartItems.id, cartItemId),
      eq(cartItems.cartId, cart.id)
    ),
    with: {
      variant: true,
    },
  });

  if (!cartItem) {
    throw new NotFoundError('Cart item not found');
  }

  if (cartItem.variant.stockQuantity < quantity) {
    throw new ValidationError(
      `Insufficient stock. Available: ${cartItem.variant.stockQuantity}, Requested: ${quantity}`,
      [{ field: 'quantity', message: `Only ${cartItem.variant.stockQuantity} units available in stock` }]
    );
  }

  const [updated] = await executor
    .update(cartItems)
    .set({
      quantity,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(cartItems.tenantId, tenantId),
        eq(cartItems.id, cartItemId)
      )
    )
    .returning();

  return updated;
}

/**
 * Removes an item from the cart.
 *
 * @param tenantId - Tenant identifier
 * @param sessionId - Session identifier
 * @param cartItemId - Cart item ID
 * @param tx - Optional transaction handle
 */
export async function removeItemFromCart(
  tenantId: string,
  sessionId: string,
  cartItemId: string,
  tx?: DbOrTx
) {
  const executor = tx ?? db;
  const cart = await getOrCreateCart(tenantId, sessionId, undefined, executor);

  const [deleted] = await executor
    .delete(cartItems)
    .where(
      and(
        eq(cartItems.tenantId, tenantId),
        eq(cartItems.id, cartItemId),
        eq(cartItems.cartId, cart.id)
      )
    )
    .returning();

  if (!deleted) {
    throw new NotFoundError('Cart item not found');
  }

  return deleted;
}

/**
 * Calculates server-authoritative cart summary:
 * - Fetches current variant and product prices from DB.
 * - Resolves price overrides or sale/list prices.
 * - Calculates subtotal in minor units.
 * - Never trusts browser/client prices.
 * - Clears expired carts (> 7 days).
 *
 * @param tenantId - Tenant identifier
 * @param sessionId - Session identifier
 * @param tx - Optional transaction handle
 */
export async function getCartSummary(
  tenantId: string,
  sessionId: string,
  tx?: DbOrTx
): Promise<CartSummary> {
  const executor = tx ?? db;
  const cart = await getOrCreateCart(tenantId, sessionId, undefined, executor);

  // Fetch all items in this cart
  const rawItems = await executor
    .select({
      cartItemId: cartItems.id,
      quantity: cartItems.quantity,
      variantId: productVariants.id,
      variantName: productVariants.name,
      variantSku: productVariants.sku,
      variantPriceOverride: productVariants.priceOverride,
      stockQuantity: productVariants.stockQuantity,
      isVariantActive: productVariants.isActive,
      productId: products.id,
      productTitle: products.title,
      productStatus: products.status,
      productSalePrice: products.salePrice,
      productListPrice: products.listPrice,
    })
    .from(cartItems)
    .innerJoin(
      productVariants,
      and(
        eq(productVariants.id, cartItems.variantId),
        eq(productVariants.tenantId, tenantId)
      )
    )
    .innerJoin(
      products,
      and(
        eq(products.id, productVariants.productId),
        eq(products.tenantId, tenantId)
      )
    )
    .where(
      and(
        eq(cartItems.tenantId, tenantId),
        eq(cartItems.cartId, cart.id)
      )
    );

  // Fetch primary image for products
  const productIds = Array.from(new Set(rawItems.map((i) => i.productId)));
  const images = productIds.length > 0
    ? await executor
        .select({
          productId: productImages.productId,
          assetId: productImages.assetId,
        })
        .from(productImages)
        .where(
          and(
            eq(productImages.tenantId, tenantId),
            sql`${productImages.productId} IN ${productIds}`
          )
        )
        .orderBy(productImages.sortOrder)
    : [];

  const imageMap = new Map<string, string>();
  for (const img of images) {
    if (!imageMap.has(img.productId)) {
      imageMap.set(img.productId, img.assetId);
    }
  }

  let subtotal = 0;
  let itemCount = 0;
  const items: CartItemSummary[] = [];

  for (const item of rawItems) {
    // Determine effective unit price in minor units:
    // 1. Variant price override if set
    // 2. Product sale price if set
    // 3. Product list price
    const unitPrice =
      item.variantPriceOverride !== null && item.variantPriceOverride !== undefined
        ? item.variantPriceOverride
        : item.productSalePrice !== null && item.productSalePrice !== undefined
        ? item.productSalePrice
        : item.productListPrice;

    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;
    itemCount += item.quantity;

    items.push({
      id: item.cartItemId,
      variantId: item.variantId,
      productId: item.productId,
      productTitle: item.productTitle,
      variantName: item.variantName,
      sku: item.variantSku,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
      imageUrl: imageMap.get(item.productId) ?? null,
      stockAvailable: item.stockQuantity,
    });
  }

  return {
    cartId: cart.id,
    sessionId: cart.sessionId,
    customerId: cart.customerId,
    items,
    itemCount,
    subtotal,
    currency: 'INR',
    expiresAt: new Date(cart.expiresAt),
  };
}

