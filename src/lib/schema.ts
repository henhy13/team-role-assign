import { z } from 'zod';

export const ApplicantSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  occupation: z.string().min(1, 'Occupation is required').max(100, 'Occupation too long'),
  skills: z.array(z.string().min(1).max(50)).min(1, 'At least one skill is required').max(10, 'Too many skills'),
  personalityTraits: z.array(z.string().min(1).max(50)).min(1, 'At least one trait is required').max(10, 'Too many traits'),
});

export const TeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Team name too long'),
  sessionId: z.string().uuid('Invalid session ID'),
});

export const SubmitApplicantSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  teamId: z.string().uuid('Invalid team ID'),
  applicant: ApplicantSchema,
});

export const AssignTeamSchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  phase: z.enum(['part1', 'part2']).optional().default('part1'),
  customRoles: z.array(z.string().min(1).max(100)).length(10).optional(),
});

export const BulkSubmitSchema = z.object({
  applications: z.array(z.object({
    sessionId: z.string().uuid('Invalid session ID'),
    teamId: z.string().uuid('Invalid team ID'),
    applicant: ApplicantSchema,
  })).min(1, 'At least one application required').max(500, 'Too many applications (max 500)'),
  options: z.object({
    validateTeamLimits: z.boolean().default(true),
    skipDuplicateNames: z.boolean().default(false),
  }).optional(),
});

export const BatchAssignSchema = z.object({
  requests: z.array(z.object({
    teamId: z.string().uuid('Invalid team ID'),
    phase: z.enum(['part1', 'part2']).optional().default('part1'),
    customRoles: z.array(z.string().min(1).max(100)).length(10).optional(),
  })).min(1, 'At least one team required').max(100, 'Too many teams (max 100)'),
  options: z.object({
    maxConcurrency: z.number().min(1).max(50).default(10),
    retryFailedRequests: z.boolean().default(true),
    includeJustifications: z.boolean().default(true),
  }).optional(),
});

export const BatchStatusSchema = z.object({
  teamIds: z.array(z.string().uuid()).optional(),
  sessionIds: z.array(z.string().uuid()).optional(),
  options: z.object({
    includeDetails: z.boolean().default(false),
    includeStats: z.boolean().default(false),
  }).optional(),
}).refine(
  (data) => data.teamIds || data.sessionIds,
  {
    message: "Either teamIds or sessionIds must be provided",
  }
);

// NEW: Session Management Schemas
export const SessionSettingsSchema = z.object({
  maxTeams: z.number().min(1).max(1000).optional(),
  maxApplicantsPerTeam: z.number().min(5).max(20).default(10),
  allowSelfRegistration: z.boolean().default(true),
  enablePart2: z.boolean().default(true),
  autoEndAfterAllComplete: z.boolean().default(false),
  sessionCode: z.string().regex(/^[A-Z0-9]{6}$/, 'Session code must be 6 uppercase letters/numbers').optional(),
});

export const CreateSessionSchema = z.object({
  name: z.string().min(1, 'Session name is required').max(200, 'Session name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  createdBy: z.string().min(1, 'Creator identifier is required').max(100, 'Creator name too long'),
  settings: SessionSettingsSchema.optional(),
});

export const UpdateSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  settings: SessionSettingsSchema.partial().optional(),
});

export const EndSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  confirmEnd: z.boolean().refine(val => val === true, 'Must confirm session end'),
  clearMemory: z.boolean().default(false),
  exportData: z.boolean().default(false),
});

export const JoinSessionSchema = z.object({
  sessionCode: z.string().regex(/^[A-Z0-9]{6}$/, 'Invalid session code format').optional(),
  sessionId: z.string().uuid('Invalid session ID').optional(),
}).refine(
  (data) => data.sessionCode || data.sessionId,
  {
    message: "Either sessionCode or sessionId must be provided",
  }
);

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues.map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`).join(', ') };
    }
    return { success: false, error: 'Validation failed' };
  }
}

export const DEFAULT_ROLES = [
  'Team Leader',
  'Technical Specialist', 
  'Creative Director',
  'Strategy Advisor',
  'Data Analyst',
  'Project Coordinator',
  'Quality Assurance',
  'Communications Lead',
  'Resource Manager',
  'Innovation Driver'
]; 