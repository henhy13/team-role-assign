import type { NextApiRequest, NextApiResponse } from 'next';
import { TeamManager } from '../../lib/teamManager';
import { validateRequest, ApplicantSchema } from '../../lib/schema';
import { ApiResponse, Applicant } from '../../types';

interface BulkApplicantData {
  teamId: string;
  applicant: Omit<Applicant, 'id' | 'submittedAt'>;
}

interface BulkSubmitRequest {
  applications: BulkApplicantData[];
  options?: {
    continueOnError?: boolean; // Whether to continue processing if individual submissions fail
    validateTeamLimits?: boolean; // Whether to enforce 10-person team limits
  };
}

interface BulkSubmitResult {
  teamId: string;
  applicantName: string;
  success: boolean;
  applicant?: Applicant;
  error?: string;
}

interface BulkSubmitResponse {
  results: BulkSubmitResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    teamsAffected: number;
    completeTeams: number;
  };
  teamsStatus: Array<{
    teamId: string;
    teamName: string;
    currentCount: number;
    isComplete: boolean;
  }>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<BulkSubmitResponse>>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    const {
      applications,
      options = {}
    }: BulkSubmitRequest = req.body;

    const {
      continueOnError = true,
      validateTeamLimits = true
    } = options;

    if (!applications || !Array.isArray(applications) || applications.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Applications array is required and must not be empty'
      });
    }

    if (applications.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 500 applications can be processed in a single batch'
      });
    }

    console.log(`Starting bulk submission of ${applications.length} applications`);

    // Pre-validate all applications
    const validationErrors: string[] = [];
    const validatedApplications: BulkApplicantData[] = [];

    for (let i = 0; i < applications.length; i++) {
      const app = applications[i];
      
      if (!app.teamId || typeof app.teamId !== 'string') {
        validationErrors.push(`Application ${i + 1}: Invalid teamId`);
        continue;
      }

      const validation = validateRequest(ApplicantSchema, app.applicant);
      if (!validation.success) {
        validationErrors.push(`Application ${i + 1}: ${validation.error}`);
        continue;
      }

      validatedApplications.push(app);
    }

    if (validationErrors.length > 0 && !continueOnError) {
      return res.status(400).json({
        success: false,
        error: `Validation errors: ${validationErrors.join('; ')}`
      });
    }

    // Pre-check team limits if requested
    if (validateTeamLimits) {
      const teamCounts = new Map<string, number>();
      
      // Count existing team sizes
      const uniqueTeamIds = [...new Set(validatedApplications.map(app => app.teamId))];
      for (const teamId of uniqueTeamIds) {
        const team = TeamManager.getTeam(teamId);
        if (team) {
          teamCounts.set(teamId, team.applicants.length);
        }
      }

      // Count new applications per team
      const newApplicationCounts = new Map<string, number>();
      for (const app of validatedApplications) {
        newApplicationCounts.set(app.teamId, (newApplicationCounts.get(app.teamId) || 0) + 1);
      }

      // Check for teams that would exceed limits
      const teamLimitErrors: string[] = [];
      for (const [teamId, newCount] of newApplicationCounts) {
        const currentCount = teamCounts.get(teamId) || 0;
        if (currentCount + newCount > 10) {
          teamLimitErrors.push(`Team ${teamId} would exceed 10-person limit (current: ${currentCount}, adding: ${newCount})`);
        }
      }

      if (teamLimitErrors.length > 0 && !continueOnError) {
        return res.status(400).json({
          success: false,
          error: `Team limit errors: ${teamLimitErrors.join('; ')}`
        });
      }
    }

    // Process applications using Promise.all for better performance
    const processingPromises = validatedApplications.map(async (app): Promise<BulkSubmitResult> => {
      try {
        // Check if team exists
        const team = TeamManager.getTeam(app.teamId);
        if (!team) {
          return {
            teamId: app.teamId,
            applicantName: app.applicant.name,
            success: false,
            error: 'Team not found'
          };
        }

        // Add applicant to team
        const result = TeamManager.addApplicant(app.teamId, app.applicant);
        if (!result.success) {
          return {
            teamId: app.teamId,
            applicantName: app.applicant.name,
            success: false,
            error: result.error
          };
        }

        return {
          teamId: app.teamId,
          applicantName: app.applicant.name,
          success: true,
          applicant: result.applicant
        };

      } catch (error) {
        return {
          teamId: app.teamId,
          applicantName: app.applicant.name,
          success: false,
          error: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    });

    // Wait for all submissions to complete
    const results = await Promise.all(processingPromises);

    // Calculate summary statistics
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const teamsAffected = new Set(results.map(r => r.teamId)).size;

    // Get current status of affected teams
    const affectedTeamIds = [...new Set(results.map(r => r.teamId))];
    const teamsStatus = await Promise.all(
      affectedTeamIds.map(async (teamId) => {
        const team = TeamManager.getTeam(teamId);
        return {
          teamId,
          teamName: team?.name || 'Unknown',
          currentCount: team?.applicants.length || 0,
          isComplete: team?.isComplete || false
        };
      })
    );

    const completeTeams = teamsStatus.filter(t => t.isComplete).length;

    const response: BulkSubmitResponse = {
      results,
      summary: {
        total: results.length,
        successful,
        failed,
        teamsAffected,
        completeTeams
      },
      teamsStatus
    };

    // Include validation errors in response if any
    let message = `Bulk submission completed: ${successful}/${results.length} applications successful`;
    if (completeTeams > 0) {
      message += `. ${completeTeams} team(s) are now complete and ready for assignment.`;
    }
    if (validationErrors.length > 0) {
      message += ` ${validationErrors.length} validation error(s) encountered.`;
    }

    console.log(`Bulk submission completed: ${successful}/${results.length} successful, ${teamsAffected} teams affected, ${completeTeams} teams complete`);

    return res.status(successful > 0 ? 200 : 400).json({
      success: successful > 0,
      data: response,
      message
    });

  } catch (error) {
    console.error('Bulk submit applicants error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during bulk submission'
    });
  }
}

// Export config for Next.js
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Large limit for bulk submissions
    },
  },
}; 