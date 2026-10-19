import type { Offer } from '../../generated/prisma/client.js';
import { OfferStatus, OfferType } from '../../generated/prisma/enums.js';

/** What the apps show, derived from status, dates and quantity. */
export enum OfferState {
  LIVE = 'LIVE',
  SCHEDULED = 'SCHEDULED',
  SOLD_OUT = 'SOLD_OUT',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
  REMOVED = 'REMOVED',
}

type OfferStateFields = Pick<
  Offer,
  'status' | 'type' | 'startsAt' | 'endsAt' | 'remainingQuantity'
>;

export function offerState(
  offer: OfferStateFields,
  now = new Date(),
): OfferState {
  if (offer.status === OfferStatus.REMOVED) return OfferState.REMOVED;
  if (offer.status === OfferStatus.ENDED || offer.endsAt <= now) {
    return OfferState.ENDED;
  }
  if (offer.status === OfferStatus.PAUSED) return OfferState.PAUSED;
  if (offer.startsAt > now) return OfferState.SCHEDULED;
  if (offer.type === OfferType.LIMITED && (offer.remainingQuantity ?? 0) <= 0) {
    return OfferState.SOLD_OUT;
  }
  return OfferState.LIVE;
}

/** Whole-number discount, e.g. 8.000 → 4.000 is 50. */
export function discountPercent(
  originalPrice: { toNumber(): number },
  offerPrice: { toNumber(): number },
): number {
  const original = originalPrice.toNumber();
  if (original <= 0) return 0;
  return Math.round((1 - offerPrice.toNumber() / original) * 100);
}
