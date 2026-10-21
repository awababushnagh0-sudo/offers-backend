export class AdminStoreStatsDto {
  total: number;
  active: number;
}

export class AdminUserStatsDto {
  customers: number;
  merchants: number;
  /** Customers who signed up in the last 7 days. */
  newCustomersLast7Days: number;
}

export class AdminOfferStatsDto {
  /** Active and not yet ended. */
  live: number;
  total: number;
}

export class AdminClaimStatsDto {
  total: number;
  redeemed: number;
  expired: number;
  /** Claims made in the last 7 days. */
  last7Days: number;
  /** Redeemed / (redeemed + expired), 0 to 1. Null before any claim finishes. */
  redemptionRate: number | null;
}

export class AdminStatsDto {
  stores: AdminStoreStatsDto;
  users: AdminUserStatsDto;
  offers: AdminOfferStatsDto;
  claims: AdminClaimStatsDto;
}
