import {
  Request,
  Response,
  NextFunction,
} from 'express';

import jwt, {
  JwtPayload,
} from 'jsonwebtoken';

import { config } from '../config';
import { UserStore } from '../models/store';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    roles: string[];
  };
}

interface AccessTokenPayload extends JwtPayload {
  sub: string;
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const authorizationHeader =
    req.headers.authorization;

  if (
    !authorizationHeader ||
    !authorizationHeader.startsWith('Bearer ')
  ) {
    res.status(401).json({
      error:
        'Missing or invalid Authorization header',
    });
    return;
  }

  const token =
    authorizationHeader.slice(7).trim();

  if (!token) {
    res.status(401).json({
      error:
        'Missing or invalid Authorization header',
    });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      config.jwt.secret,
    );

    if (
      typeof decoded === 'string' ||
      typeof decoded.sub !== 'string' ||
      !decoded.sub
    ) {
      res.status(401).json({
        error: 'Invalid or expired token',
      });
      return;
    }

    const payload =
      decoded as AccessTokenPayload;

    const user =
      UserStore.findById(payload.sub);

    if (!user) {
      res.status(401).json({
        error: 'Invalid or expired token',
      });
      return;
    }

    req.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      roles: user.roles,
    };

    next();
  } catch {
    res.status(401).json({
      error: 'Invalid or expired token',
    });
  }
}

export function requireRole(
  requiredRole: string,
) {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    if (
      !req.user.roles.includes(requiredRole)
    ) {
      res.status(403).json({
        error: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}