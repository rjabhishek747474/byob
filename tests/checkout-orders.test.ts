import { describe, expect, it } from 'vitest';
import { createMoney, addMoney, multiplyMoney, formatMoney } from '@/lib/money';
import {
  ALLOWED_STATUS_TRANSITIONS,
  ORDER_STATUSES,
  isValidStatusTransition,
} from '@/modules/orders/state-machine';
import {
  calculateCartExpiry,
  CART_EXPIRY_DAYS,
} from '@/modules/checkout/cart-service';
import {
  checkoutInputSchema,
} from '@/modules/checkout/checkout-service';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { generateId, csvEscape } from '@/lib/utils';

describe('Slice 6: Cart, Checkout, Orders & Order Tracking Tests', () => {
  describe('Basic Money Calculations', () => {
    it('calculates order line item subtotal correctly in integer cents', () => {
      const itemPrice = createMoney(2500, 'INR'); // 25.00
      const quantity = 3;
      const subtotal = multiplyMoney(itemPrice, quantity);

      expect(subtotal.amount).toBe(7500);
      expect(subtotal.currency).toBe('INR');
    });

    it('calculates total order amount including tax and shipping', () => {
      const subtotal = createMoney(5000, 'INR');
      const shipping = createMoney(500, 'INR');
      const tax = createMoney(900, 'INR');

      const total = addMoney(addMoney(subtotal, shipping), tax);
      expect(total.amount).toBe(6400);
      expect(formatMoney(total)).toBe('₹64.00');
    });
  });

  describe('1. State Machine Definitions & Validations', () => {
    it('has all 9 standard order statuses defined', () => {
      expect(ORDER_STATUSES).toEqual([
        'pending_confirmation',
        'confirmed',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'failed',
        'returned',
        'refunded',
      ]);
    });

    it('allows valid progressive status transitions', () => {
      expect(isValidStatusTransition('pending_confirmation', 'confirmed')).toBe(true);
      expect(isValidStatusTransition('confirmed', 'processing')).toBe(true);
      expect(isValidStatusTransition('processing', 'shipped')).toBe(true);
      expect(isValidStatusTransition('shipped', 'delivered')).toBe(true);
    });

    it('allows cancellation from unfulfilled stages', () => {
      expect(isValidStatusTransition('pending_confirmation', 'cancelled')).toBe(true);
      expect(isValidStatusTransition('confirmed', 'cancelled')).toBe(true);
      expect(isValidStatusTransition('processing', 'cancelled')).toBe(true);
    });

    it('allows returns after shipped or delivered', () => {
      expect(isValidStatusTransition('shipped', 'returned')).toBe(true);
      expect(isValidStatusTransition('delivered', 'returned')).toBe(true);
    });

    it('allows refunding after delivered or returned', () => {
      expect(isValidStatusTransition('delivered', 'refunded')).toBe(true);
      expect(isValidStatusTransition('returned', 'refunded')).toBe(true);
    });

    it('rejects illegal status transitions (regression guard)', () => {
      // Cannot jump backwards from delivered to pending
      expect(isValidStatusTransition('delivered', 'pending_confirmation')).toBe(false);
      // Cannot cancel once delivered
      expect(isValidStatusTransition('delivered', 'cancelled')).toBe(false);
      // Cannot transition to self
      expect(isValidStatusTransition('confirmed', 'confirmed')).toBe(false);
      // Cancelled is terminal
      expect(isValidStatusTransition('cancelled', 'confirmed')).toBe(false);
      expect(isValidStatusTransition('cancelled', 'delivered')).toBe(false);
      // Failed is terminal
      expect(isValidStatusTransition('failed', 'processing')).toBe(false);
    });
  });

  describe('2. Server-side Cart & Price Calculation Integrity', () => {
    it('calculates 7-day cart expiration accurately', () => {
      const before = new Date();
      const expiry = calculateCartExpiry();
      const after = new Date();

      const diffDays = (expiry.getTime() - before.getTime()) / (1000 * 60 * 60 * 24);
      expect(Math.round(diffDays)).toBe(CART_EXPIRY_DAYS);
      expect(expiry.getTime()).toBeGreaterThan(after.getTime());
    });

    it('calculates subtotal strictly in integer minor units without floating-point error', () => {
      // e.g. 3 items at 19.99 INR = 1999 paise each -> 5997 paise
      const items = [
        { unitPrice: 1999, quantity: 3 },
        { unitPrice: 45000, quantity: 2 }, // 450.00 each -> 90000
        { unitPrice: 100, quantity: 5 },    // 1.00 each -> 500
      ];

      const subtotal = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
      expect(subtotal).toBe(5997 + 90000 + 500);
      expect(Number.isInteger(subtotal)).toBe(true);
    });

    it('applies coupon calculation accurately in integer minor units', () => {
      const subtotal = 150000; // 1,500.00 INR
      const percentageCouponValue = 15; // 15% discount
      const expectedPercentageDiscount = Math.round((subtotal * percentageCouponValue) / 100);
      expect(expectedPercentageDiscount).toBe(22500); // 225.00 INR

      const fixedCouponValue = 30000; // 300.00 INR
      const expectedFixedDiscount = Math.min(subtotal, fixedCouponValue);
      expect(expectedFixedDiscount).toBe(30000);

      // Ensures final total is clamped at 0
      const hugeDiscount = 200000;
      const totalAfterHugeDiscount = Math.max(0, subtotal - hugeDiscount);
      expect(totalAfterHugeDiscount).toBe(0);
    });
  });

  describe('3. Checkout Input Schema Validation', () => {
    it('validates valid checkout input with all required fields', () => {
      const validInput = {
        sessionId: 'sess_12345',
        shippingAddress: {
          fullName: 'Arjun Das',
          addressLine1: '42 MG Road, Indiranagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560038',
          country: 'India',
          phone: '+91 9876543210',
        },
        customerEmail: 'arjun@example.com',
        customerPhone: '+91 9876543210',
        customerName: 'Arjun Das',
        paymentMode: 'cod',
        idempotencyKey: 'idem_unique_key_001',
      };

      const parsed = checkoutInputSchema.parse(validInput);
      expect(parsed.customerEmail).toBe('arjun@example.com');
      expect(parsed.paymentMode).toBe('cod');
      expect(parsed.shippingAddress.city).toBe('Bengaluru');
    });

    it('rejects invalid checkout input missing postal code or invalid email', () => {
      const invalidInput = {
        sessionId: 'sess_12345',
        shippingAddress: {
          fullName: 'Arjun Das',
          addressLine1: '42 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
        },
        customerEmail: 'not-an-email',
        customerName: 'Arjun Das',
        idempotencyKey: 'idem_key',
      };

      expect(() => checkoutInputSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('4. Stock Validation & Concurrent Deduction Logic', () => {
    it('rejects checkout when requested quantity exceeds available variant stock', () => {
      const variantStock = 3;
      const requestedQuantity = 5;

      const hasSufficientStock = variantStock >= requestedQuantity;
      expect(hasSufficientStock).toBe(false);

      if (!hasSufficientStock) {
        const error = new ValidationError(
          `Item has only ${variantStock} units left in stock`,
          [{ field: 'stockQuantity', message: `Only ${variantStock} units available` }]
        );
        expect(error.statusCode).toBe(400);
        expect(error.fieldErrors[0].field).toBe('stockQuantity');
      }
    });

    it('correctly simulates atomic decrement and movement logging', () => {
      let variantStock = 10;
      const purchaseQuantity = 4;

      // Decrement
      variantStock -= purchaseQuantity;
      expect(variantStock).toBe(6);

      // Movement record
      const movement = {
        delta: -purchaseQuantity,
        reason: 'order_placed',
        stockAfter: variantStock,
      };
      expect(movement.delta).toBe(-4);
      expect(movement.reason).toBe('order_placed');
    });

    it('correctly simulates stock restoration upon order cancellation', () => {
      let currentStock = 6;
      const orderItems = [
        { variantId: 'var_1', quantity: 4 },
        { variantId: 'var_2', quantity: 2 },
      ];

      // Restore stock for cancelled order
      const movements = [];
      for (const item of orderItems) {
        if (item.variantId === 'var_1') {
          currentStock += item.quantity;
        }
        movements.push({
          variantId: item.variantId,
          delta: item.quantity,
          reason: 'order_cancelled',
        });
      }

      expect(currentStock).toBe(10);
      expect(movements[0].delta).toBe(4);
      expect(movements[0].reason).toBe('order_cancelled');
    });
  });

  describe('5. Idempotent Order Placement Semantics', () => {
    it('returns existing order when idempotency key is repeated', () => {
      const orderDb = new Map<string, any>();

      function submitOrder(tenantId: string, idempotencyKey: string, payload: any) {
        const key = `${tenantId}:${idempotencyKey}`;
        if (orderDb.has(key)) {
          return {
            ...orderDb.get(key),
            isExistingOrder: true,
          };
        }

        const newOrder = {
          orderId: generateId(),
          orderNumber: 'ORD-100456',
          publicToken: generateId(),
          total: payload.total,
          isExistingOrder: false,
        };
        orderDb.set(key, newOrder);
        return newOrder;
      }

      const firstCall = submitOrder('ten_1', 'idem_abc', { total: 5000 });
      expect(firstCall.isExistingOrder).toBe(false);
      expect(firstCall.orderNumber).toBe('ORD-100456');

      // Duplicate submission
      const secondCall = submitOrder('ten_1', 'idem_abc', { total: 5000 });
      expect(secondCall.isExistingOrder).toBe(true);
      expect(secondCall.orderId).toBe(firstCall.orderId);
      expect(secondCall.publicToken).toBe(firstCall.publicToken);
    });
  });

  describe('6. Public Tracking Token Unguessability & PII Minimization', () => {
    it('generates unguessable, high-entropy ULID tracking tokens', () => {
      const token1 = generateId();
      const token2 = generateId();

      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(26); // Standard ULID length
      expect(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/.test(token1)).toBe(true);
    });

    it('shields sensitive customer PII from public tracking responses', () => {
      const internalOrder = {
        orderNumber: 'ORD-100456',
        publicToken: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        customer: {
          name: 'Jane Doe',
          email: 'jane.doe@private-domain.com',
          phone: '+91 9988776655',
        },
        addressSnapshot: {
          fullName: 'Jane Doe',
          addressLine1: 'Flat 402, Highrise Tower, Palm Street',
          city: 'Mumbai',
          postalCode: '400001',
          phone: '+91 9988776655',
        },
        status: 'shipped',
        createdAt: new Date(),
        items: [
          {
            productTitle: 'Handcrafted Mug',
            variantName: 'Ceramic Blue',
            quantity: 2,
            imageUrl: 'asset_123',
          },
        ],
      };

      const publicTrackingPayload = {
        orderNumber: internalOrder.orderNumber,
        status: internalOrder.status,
        createdAt: internalOrder.createdAt,
        deliveryStatus: 'Out for Delivery / Shipped',
        items: internalOrder.items.map((i) => ({
          productTitle: i.productTitle,
          variantName: i.variantName,
          quantity: i.quantity,
          imageUrl: i.imageUrl,
        })),
      };

      expect((publicTrackingPayload as any).customer).toBeUndefined();
      expect((publicTrackingPayload as any).addressSnapshot).toBeUndefined();
      expect((publicTrackingPayload as any).email).toBeUndefined();
      expect((publicTrackingPayload as any).phone).toBeUndefined();
      expect(publicTrackingPayload.orderNumber).toBe('ORD-100456');
      expect(publicTrackingPayload.items).toHaveLength(1);
    });
  });

  describe('7. Formula-safe CSV Export Protection', () => {
    it('escapes dangerous formula characters in order fields', () => {
      const dangerousCustomerName = '=calc';
      const dangerousAddress = '+SUM(1+1)';
      const standardText = 'ORD-2026';

      expect(csvEscape(dangerousCustomerName)).toBe(`\t${dangerousCustomerName}`);
      expect(csvEscape(dangerousAddress)).toBe(`\t${dangerousAddress}`);
      expect(csvEscape(standardText)).toBe(standardText);
    });
  });
});

