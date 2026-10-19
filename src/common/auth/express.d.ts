import type { AuthUser } from './auth-user.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}
