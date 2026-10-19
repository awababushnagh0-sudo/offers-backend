export class PeriodStatsDto {
  claims: number;
  redeemed: number;
  expired: number;
  /** Redeemed / (redeemed + expired), 0 to 1. Null before any claim finishes. */
  redemptionRate: number | null;
}

export class TopOfferDto {
  offerId: string;
  title: string;
  views: number;
  claims: number;
  redeemed: number;
}

export class StoreStatsDto {
  /** Offers customers can claim right now. */
  liveOffers: number;
  /** Customers on their way (reserved, not expired). */
  activeReservations: number;
  /** Since midnight, Libya time. */
  today: PeriodStatsDto;
  last30Days: PeriodStatsDto;
  /** Most redeemed offers in the last 30 days. */
  topOffers: TopOfferDto[];
}
