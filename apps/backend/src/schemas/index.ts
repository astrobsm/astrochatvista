// ============================================================================
// CHATVISTA - Validation Schemas
// Zod schemas for request validation
// ============================================================================

import { z } from 'zod';

// ============================================================================
// Auth Schemas
// ============================================================================

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const mfaVerifySchema = z.object({
  mfaToken: z.string().min(1, 'MFA token is required'),
  code: z.string().length(6, 'Code must be 6 digits'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatar: z.string().url().optional().nullable(),
});

// ============================================================================
// Meeting Schemas
// ============================================================================

export const createMeetingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  scheduledAt: z.string().datetime().optional(),
  duration: z.number().min(5).max(480).optional().default(60),
  settings: z
    .object({
      waitingRoom: z.boolean().optional(),
      allowRecording: z.boolean().optional(),
      enableTranscription: z.boolean().optional(),
      maxParticipants: z.number().min(2).max(100).optional(),
    })
    .optional(),
});

export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  scheduledAt: z.string().datetime().optional(),
  duration: z.number().min(5).max(480).optional(),
  settings: z
    .object({
      waitingRoom: z.boolean().optional(),
      allowRecording: z.boolean().optional(),
      enableTranscription: z.boolean().optional(),
      maxParticipants: z.number().min(2).max(100).optional(),
    })
    .optional(),
});

export const inviteParticipantsSchema = z.object({
  emails: z.array(z.string().email()).min(1, 'At least one email is required'),
});

// ============================================================================
// Recording Schemas
// ============================================================================

export const startRecordingSchema = z.object({
  meetingId: z.string().uuid('Invalid meeting ID'),
});

// ============================================================================
// Export Schemas
// ============================================================================

export const createExportSchema = z.object({
  meetingId: z.string().uuid('Invalid meeting ID'),
  type: z.enum(['transcript', 'minutes', 'recording', 'full']),
  format: z.enum(['pdf', 'docx', 'txt', 'srt', 'vtt']),
});

// ============================================================================
// Query Schemas
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

export const meetingQuerySchema = paginationSchema.extend({
  status: z.enum(['scheduled', 'live', 'ended']).optional(),
  search: z.string().optional(),
});

// ============================================================================
// Param Schemas
// ============================================================================

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const meetingIdParamSchema = z.object({
  meetingId: z.string().uuid('Invalid meeting ID'),
});

// ============================================================================
// Type Exports
// ============================================================================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
export type CreateExportInput = z.infer<typeof createExportSchema>;
