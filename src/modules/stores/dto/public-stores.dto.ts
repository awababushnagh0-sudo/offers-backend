import { CategoryDto } from '../../categories/dto/category.dto.js';
import {
  PublicBranchDto,
  PublicOfferDto,
} from '../../offers/dto/public-offers.dto.js';

export class PublicStoreDto {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  phone: string | null;
  email: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  category: CategoryDto;
  /** Active branches, closest first when a location is sent. */
  branches: PublicBranchDto[];
  followerCount: number;
  /** Null when not logged in as a customer. */
  isFollowing: boolean | null;
  /** Offers live right now, ending soonest first. */
  offers: PublicOfferDto[];
}

export class FollowedStoreDto {
  id: string;
  name: string;
  logoUrl: string | null;
  category: CategoryDto;
  liveOfferCount: number;
  followedAt: Date;
}
