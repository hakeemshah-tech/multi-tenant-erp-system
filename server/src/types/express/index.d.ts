import { AuthTokenPayload } from "@/app/auth/auth.types";

declare global {
  namespace Express {
    interface Request {
      user: AuthTokenPayload;
    }
  }
}
