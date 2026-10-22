import type { StoreAccess } from '../../modules/stores/access/store-access.js';
import type { AuthUser } from './auth-user.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    /** Set by StoreAccessGuard on /partner/stores/:storeId routes. */
    storeAccess?: StoreAccess;
  }
}
