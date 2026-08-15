import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import {
  UserStore,
  DocumentStore,
  AnalysisStore,
} from '../models/store';

import { config } from '../config';
import {
  authenticate,
  AuthRequest,
} from '../middleware/auth';

import { AuditService } from '../services/auditService';
import logger from '../services/logger';

const router = Router();

/* -------------------------------------------------------------------------- */
/*                                Validation                                  */
/* -------------------------------------------------------------------------- */

const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine(
    (password) => /[A-Z]/.test(password),
    'Password must contain at least one uppercase letter',
  )
  .refine(
    (password) => /[0-9]/.test(password),
    'Password must contain at least one number',
  );

const SignupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters'),

  email: z
    .string()
    .trim()
    .email('Invalid email address'),

  password: PasswordSchema,

  languagePreference: z
    .string()
    .trim()
    .min(1, 'Language preference is required')
    .default('en'),
});

const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Invalid email address'),

  password: z
    .string()
    .min(1, 'Password is required'),
});

const UpdateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .optional(),

  languagePreference: z
    .string()
    .trim()
    .min(1, 'Language preference is required')
    .optional(),
});

const ChangePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required'),

  newPassword: PasswordSchema,
});

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createToken(userId: string): string {
  return jwt.sign(
    { sub: userId },
    config.jwt.secret,
    {
      expiresIn:
        config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    },
  );
}

function getValidationMessage(error: z.ZodError): string {
  return error.errors
    .map((issue) => issue.message)
    .join('. ');
}

function publicUser(user: {
  _id: string;
  name: string;
  email: string;
  languagePreference: string;
}) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    languagePreference: user.languagePreference,
  };
}

/* -------------------------------------------------------------------------- */
/*                                POST signup                                 */
/* -------------------------------------------------------------------------- */

router.post(
  '/signup',
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const {
        name,
        email,
        password,
        languagePreference,
      } = SignupSchema.parse(req.body);

      const normalizedEmail = normalizeEmail(email);

      const existingUser =
        UserStore.findByEmail(normalizedEmail);

      if (existingUser) {
        res.status(409).json({
          error: 'Email already in use',
        });
        return;
      }

      const hashedPassword =
        await bcrypt.hash(password, 12);

      const user = UserStore.create({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        roles: ['user'],
        languagePreference,
      });

      const token = createToken(user._id);

      AuditService.log(
        user._id,
        'user.signup',
        { method: 'email' },
        req,
      );

      logger.info(
        `New user signed up: ${user._id}`,
      );

      res.status(201).json({
        token,
        user: publicUser(user),
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: getValidationMessage(error),
        });
        return;
      }

      logger.error('Signup failed', {
        error,
      });

      res.status(500).json({
        error: 'Internal server error',
      });
    }
  },
);

/* -------------------------------------------------------------------------- */
/*                                 POST login                                 */
/* -------------------------------------------------------------------------- */

router.post(
  '/login',
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const {
        email,
        password,
      } = LoginSchema.parse(req.body);

      const normalizedEmail = normalizeEmail(email);

      /*
       * Login must only authenticate an existing user.
       *
       * Never:
       * - automatically create a user;
       * - bypass password verification;
       * - provide special treatment to a demo email.
       */
      const user =
        UserStore.findByEmail(normalizedEmail);

      if (!user) {
        res.status(401).json({
          error: 'Invalid email or password',
        });
        return;
      }

      const passwordValid =
        await bcrypt.compare(
          password,
          user.password,
        );

      if (!passwordValid) {
        res.status(401).json({
          error: 'Invalid email or password',
        });
        return;
      }

      const token = createToken(user._id);

      AuditService.log(
        user._id,
        'user.login',
        { method: 'password' },
        req,
      );

      logger.info(
        `Successful login for user ${user._id}`,
      );

      res.status(200).json({
        token,
        user: publicUser(user),
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error:
            error.errors[0]?.message ||
            'Validation failed',
        });
        return;
      }

      logger.error('Login failed', {
        error,
      });

      res.status(500).json({
        error: 'Internal server error',
      });
    }
  },
);

/* -------------------------------------------------------------------------- */
/*                                  GET me                                    */
/* -------------------------------------------------------------------------- */

router.get(
  '/me',
  authenticate,
  (
    req: AuthRequest,
    res: Response,
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    const user =
      UserStore.findById(req.user.id);

    if (!user) {
      res.status(404).json({
        error: 'User not found',
      });
      return;
    }

    res.status(200).json({
      user: publicUser(user),
    });
  },
);

/* -------------------------------------------------------------------------- */
/*                                  PUT me                                    */
/* -------------------------------------------------------------------------- */

router.put(
  '/me',
  authenticate,
  async (
    req: AuthRequest,
    res: Response,
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    try {
      const updates =
        UpdateProfileSchema.parse(req.body);

      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          error: 'No valid profile fields provided',
        });
        return;
      }

      const updatedUser =
        UserStore.update(
          req.user.id,
          updates,
        );

      if (!updatedUser) {
        res.status(404).json({
          error: 'User not found',
        });
        return;
      }

      AuditService.log(
        req.user.id,
        'user.profile_updated',
        {
          changedFields: Object.keys(updates),
        },
        req,
      );

      logger.info(
        `Profile updated for user ${req.user.id}`,
      );

      res.status(200).json({
        user: publicUser(updatedUser),
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: getValidationMessage(error),
        });
        return;
      }

      logger.error('Profile update failed', {
        userId: req.user.id,
        error,
      });

      res.status(500).json({
        error: 'Internal server error',
      });
    }
  },
);

/* -------------------------------------------------------------------------- */
/*                           POST change-password                             */
/* -------------------------------------------------------------------------- */

router.post(
  '/change-password',
  authenticate,
  async (
    req: AuthRequest,
    res: Response,
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    try {
      const {
        currentPassword,
        newPassword,
      } = ChangePasswordSchema.parse(req.body);

      const user =
        UserStore.findById(req.user.id);

      if (!user) {
        res.status(404).json({
          error: 'User not found',
        });
        return;
      }

      const currentPasswordValid =
        await bcrypt.compare(
          currentPassword,
          user.password,
        );

      if (!currentPasswordValid) {
        res.status(401).json({
          error: 'Current password is incorrect',
        });
        return;
      }

      const sameAsCurrentPassword =
        await bcrypt.compare(
          newPassword,
          user.password,
        );

      if (sameAsCurrentPassword) {
        res.status(400).json({
          error:
            'New password must be different from the current password',
        });
        return;
      }

      const hashedPassword =
        await bcrypt.hash(newPassword, 12);

      const updatedUser =
        UserStore.update(
          req.user.id,
          {
            password: hashedPassword,
          },
        );

      if (!updatedUser) {
        res.status(404).json({
          error: 'User not found',
        });
        return;
      }

      AuditService.log(
        req.user.id,
        'user.password_changed',
        {},
        req,
      );

      logger.info(
        `Password changed for user ${req.user.id}`,
      );

      res.status(200).json({
        message: 'Password updated successfully',
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: getValidationMessage(error),
        });
        return;
      }

      logger.error('Password change failed', {
        userId: req.user.id,
        error,
      });

      res.status(500).json({
        error: 'Internal server error',
      });
    }
  },
);

/* -------------------------------------------------------------------------- */
/*                                DELETE me                                   */
/* -------------------------------------------------------------------------- */

router.delete(
  '/me',
  authenticate,
  (
    req: AuthRequest,
    res: Response,
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    const userId = req.user.id;

    const existingUser =
      UserStore.findById(userId);

    if (!existingUser) {
      res.status(404).json({
        error: 'User not found',
      });
      return;
    }

    const documents =
      DocumentStore.findByUser(userId);

    for (const document of documents) {
      DocumentStore.delete(document._id);
    }

    const analyses =
      AnalysisStore.findByUser(userId);

    for (const analysis of analyses) {
      AnalysisStore.delete(analysis._id);
    }

    UserStore.delete(userId);

    AuditService.log(
      userId,
      'user.account_deleted',
      {
        documentCount: documents.length,
        analysisCount: analyses.length,
      },
      req,
    );

    logger.info(
      `Account deleted for user ${userId}`,
    );

    res.status(204).send();
  },
);

export default router;