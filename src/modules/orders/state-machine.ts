/**
 * Order status state machine definition and transition validation.
 */

export const ORDER_STATUSES = [
  'pending_confirmation',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'failed',
  'returned',
  'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Valid state transitions mapping.
 *
 * Rules:
 * - pending_confirmation -> confirmed | cancelled
 * - confirmed -> processing | cancelled
 * - processing -> shipped | cancelled
 * - shipped -> delivered | returned
 * - delivered -> returned | refunded
 * - cancelled -> terminal (no transitions)
 * - failed -> terminal (no transitions)
 * - returned -> refunded
 * - refunded -> terminal
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned', 'refunded'],
  cancelled: [],
  failed: [],
  returned: ['refunded'],
  refunded: [],
};

/**
 * Validates if an order status transition is permissible according to the state machine.
 *
 * @param currentStatus - Current order status
 * @param targetStatus - Proposed target order status
 * @returns boolean indicating if transition is permitted
 */
export function isValidStatusTransition(
  currentStatus: string,
  targetStatus: string
): boolean {
  if (currentStatus === targetStatus) {
    return false;
  }

  const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus as OrderStatus];
  if (!allowedNext) {
    return false;
  }

  return allowedNext.includes(targetStatus as OrderStatus);
}

