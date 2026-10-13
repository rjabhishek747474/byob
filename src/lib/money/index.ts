import { ValidationError } from '../errors';

/**
 * Representation of monetary value in minor units (e.g. paise, cents).
 * Never uses floating point for currency representation.
 */
export interface Money {
  readonly amount: number;
  readonly currency: string;
}

/**
 * Validates that an amount is a finite integer (no floats, NaN, or Infinity).
 *
 * @param amount - The value to inspect
 * @param context - The field or operation context for the error message
 */
function assertFiniteInteger(amount: unknown, context = 'Amount'): asserts amount is number {
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    !Number.isInteger(amount)
  ) {
    throw new ValidationError(
      `${context} must be a finite integer, received: ${String(amount)}`
    );
  }
}

/**
 * Validates currency string representation.
 *
 * @param currency - The currency code
 */
function assertValidCurrency(currency: unknown): asserts currency is string {
  if (
    typeof currency !== 'string' ||
    currency.trim().length === 0 ||
    currency.trim().length > 10
  ) {
    throw new ValidationError(
      `Currency must be a non-empty string code, received: ${String(currency)}`
    );
  }
}

/**
 * Type guard to check if an unknown object conforms to the Money interface.
 *
 * @param m - The value to verify
 */
export function isValidMoney(m: unknown): m is Money {
  if (typeof m !== 'object' || m === null) {
    return false;
  }

  const candidate = m as Partial<Money>;
  return (
    typeof candidate.amount === 'number' &&
    Number.isFinite(candidate.amount) &&
    Number.isInteger(candidate.amount) &&
    typeof candidate.currency === 'string' &&
    candidate.currency.trim().length > 0
  );
}

/**
 * Immutable zero-value INR money constant.
 */
export const ZERO_INR: Money = Object.freeze({
  amount: 0,
  currency: 'INR',
});

/**
 * Creates a Money object in integer minor units (e.g. paise, cents).
 * Validates that amount is an integer.
 *
 * @param amount - Amount in integer minor units
 * @param currency - ISO 4217 currency code (default 'INR')
 */
export function createMoney(amount: number, currency = 'INR'): Money {
  assertFiniteInteger(amount, 'Money amount');
  assertValidCurrency(currency);

  return Object.freeze({
    amount,
    currency: currency.trim().toUpperCase(),
  });
}

/**
 * Adds two Money values together.
 * Validates that both values use the identical currency.
 *
 * @param a - First money operand
 * @param b - Second money operand
 */
export function addMoney(a: Money, b: Money): Money {
  if (!isValidMoney(a)) {
    throw new ValidationError('Operand a is not a valid Money object');
  }
  if (!isValidMoney(b)) {
    throw new ValidationError('Operand b is not a valid Money object');
  }

  if (a.currency !== b.currency) {
    throw new ValidationError(
      `Cannot add money with mismatched currencies: ${a.currency} and ${b.currency}`
    );
  }

  const result = a.amount + b.amount;
  assertFiniteInteger(result, 'Addition result');

  return createMoney(result, a.currency);
}

/**
 * Subtracts money value b from money value a (a - b).
 * Validates identical currency.
 *
 * @param a - Base money value
 * @param b - Money value to subtract
 */
export function subtractMoney(a: Money, b: Money): Money {
  if (!isValidMoney(a)) {
    throw new ValidationError('Operand a is not a valid Money object');
  }
  if (!isValidMoney(b)) {
    throw new ValidationError('Operand b is not a valid Money object');
  }

  if (a.currency !== b.currency) {
    throw new ValidationError(
      `Cannot subtract money with mismatched currencies: ${a.currency} and ${b.currency}`
    );
  }

  const result = a.amount - b.amount;
  assertFiniteInteger(result, 'Subtraction result');

  return createMoney(result, a.currency);
}

/**
 * Multiplies a Money value by a quantity or factor, rounding to nearest integer minor unit.
 *
 * @param m - Base money value
 * @param quantity - Numeric multiplier (must be finite)
 */
export function multiplyMoney(m: Money, quantity: number): Money {
  if (!isValidMoney(m)) {
    throw new ValidationError('Multiplier target is not a valid Money object');
  }

  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    throw new ValidationError(
      `Quantity multiplier must be a finite number, received: ${String(quantity)}`
    );
  }

  const result = Math.round(m.amount * quantity);
  assertFiniteInteger(result, 'Multiplication result');

  return createMoney(result, m.currency);
}

/**
 * Applies a percentage discount (0 to 100) to a Money value, rounding resulting price down.
 *
 * @param m - Original price
 * @param percent - Discount percentage between 0 and 100
 */
export function applyPercentageDiscount(m: Money, percent: number): Money {
  if (!isValidMoney(m)) {
    throw new ValidationError('Discount target is not a valid Money object');
  }

  if (
    typeof percent !== 'number' ||
    !Number.isFinite(percent) ||
    percent < 0 ||
    percent > 100
  ) {
    throw new ValidationError(
      `Discount percentage must be between 0 and 100, received: ${String(percent)}`
    );
  }

  // Calculate discounted amount, rounding down to prevent overcharging customer
  const discountedAmount = Math.max(0, Math.floor((m.amount * (100 - percent)) / 100));
  assertFiniteInteger(discountedAmount, 'Percentage discount result');

  return createMoney(discountedAmount, m.currency);
}

/**
 * Applies a fixed discount amount to a base Money value.
 * Validates identical currency and ensures the result never drops below zero.
 *
 * @param m - Original price
 * @param discount - Fixed discount amount
 */
export function applyFixedDiscount(m: Money, discount: Money): Money {
  if (!isValidMoney(m)) {
    throw new ValidationError('Target is not a valid Money object');
  }
  if (!isValidMoney(discount)) {
    throw new ValidationError('Discount is not a valid Money object');
  }

  if (m.currency !== discount.currency) {
    throw new ValidationError(
      `Cannot apply discount with mismatched currencies: ${m.currency} and ${discount.currency}`
    );
  }

  if (discount.amount < 0) {
    throw new ValidationError('Discount amount cannot be negative');
  }

  const finalAmount = Math.max(0, m.amount - discount.amount);
  return createMoney(finalAmount, m.currency);
}

/**
 * Formats a Money value into human-readable currency string.
 * Converts integer minor units (e.g. 1500 paise) to major units (e.g. ₹15.00).
 *
 * @param m - Money object to format
 * @param locale - Formatting locale (default 'en-IN')
 */
export function formatMoney(m: Money, locale = 'en-IN'): string {
  if (!isValidMoney(m)) {
    throw new ValidationError('Cannot format invalid Money value');
  }

  const majorUnits = m.amount / 100;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: m.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(majorUnits);
  } catch {
    // Fallback for custom or unrecognized currency codes
    return `${m.currency} ${majorUnits.toFixed(2)}`;
  }
}
