export class StoreStatsDto {
  total: number;
  active: number;
}

export class UserStatsDto {
  customers: number;
  merchants: number;
  /** Customers who signed up in the last 7 days. */
  newCustomersLast7Days: number;
}

export class OfferStatsDto {
  /** Active and not yet ended. */
  live: number;
  total: number;
}

export class ClaimStatsDto {
  total: number;
  redeemed: number;
  expired: number;
  /** Claims made in the last 7 days. */
  last7Days: number;
  /** Redeemed / (redeemed + expired), 0 to 1. Null before any claim finishes. */
  redemptionRate: number | null;
}

export class AdminStatsDto {
  stores: StoreStatsDto;
  users: UserStatsDto;
  offers: OfferStatsDto;
  claims: ClaimStatsDto;
}
