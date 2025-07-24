import type { NextApiRequest, NextApiResponse } from 'next';
import { TeamManager } from '../../lib/teamManager';
import { Scorer } from '../../lib/scorer';
import { Assigner } from '../../lib/assigner';
import { Justifier } from '../../lib/justifier';
import { ApiResponse, Team, RoleDefinition } from '../../types';

interface BatchAssignRequest {
  teamIds: string[];
  phase?: 'part1' | 'part2';
  customRolesArray?: string[][]; // Array of custom roles for each team (for part2)
  options?: {
    maxConcurrency?: number;
    includeJustifications?: boolean;
    retryFailedRequests?: boolean;
  };
}

interface BatchAssignResult {
  teamId: string;
  sessionId?: string;
  success: boolean;
  error?: string;
  assignment?: any;
  justificationsPending?: boolean;
}

interface BatchAssignResponse {
  results: BatchAssignResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    withJustifications: number;
  };
  processingTime: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<BatchAssignResponse>>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  const startTime = Date.now();

  try {
    // Get OpenRouter API key from environment
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return res.status(500).json({
        success: false,
        error: 'OpenRouter API key not configured'
      });
    }

    const {
      teamIds,
      phase = 'part1',
      customRolesArray,
      options = {}
    }: BatchAssignRequest = req.body;

    const {
      maxConcurrency = 10,
      includeJustifications = true,
      retryFailedRequests = true
    } = options;

    if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'teamIds array is required and must not be empty'
      });
    }

    if (teamIds.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 teams can be processed in a single batch'
      });
    }

    console.log(`Starting batch assignment for ${teamIds.length} teams with phase ${phase}`);

    // Step 1: Validate all teams and create sessions
    const teams: Team[] = [];
    const sessions: any[] = [];
    const rolesArray: RoleDefinition[][] = [];

    for (let i = 0; i < teamIds.length; i++) {
      const teamId = teamIds[i];
      const team = TeamManager.getTeam(teamId);
      
      if (!team) {
        return res.status(404).json({
          success: false,
          error: `Team not found: ${teamId}`
        });
      }

      if (!team.isComplete) {
        return res.status(400).json({
          success: false,
          error: `Team ${teamId} must have exactly 10 applicants before assignment`
        });
      }

      // Create assignment session
      const customRoles = customRolesArray ? customRolesArray[i] : undefined;
      const sessionResult = TeamManager.createAssignmentSession(teamId, phase, customRoles);
      
      if (!sessionResult.success) {
        return res.status(400).json({
          success: false,
          error: `Failed to create session for team ${teamId}: ${sessionResult.error}`
        });
      }

      teams.push(team);
      sessions.push(sessionResult.session!);
      rolesArray.push(sessionResult.session!.roles);
    }

    // Step 2: Batch generate score matrices using Promise.all
    console.log(`Generating score matrices for ${teams.length} teams...`);
    
    for (const session of sessions) {
      TeamManager.updateSessionStatus(session.id, 'scoring');
    }

    const scoringResult = await Scorer.generateScoreMatricesBatch(
      teams,
      rolesArray,
      openRouterApiKey,
      {
        maxConcurrency,
        retryFailedRequests
      }
    );

    // Step 3: Process assignments for successful scorings
    const assignmentResults: BatchAssignResult[] = [];
    const teamsWithAssignments: { team: Team; roles: RoleDefinition[]; assignment: any; sessionId: string }[] = [];

    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const session = sessions[i];
      const roles = rolesArray[i];
      const scoringData = scoringResult.results.find(r => r.teamId === team.id);

      if (scoringData?.success && scoringData.scoreMatrix) {
        // Update session with score matrix
        session.scoreMatrix = scoringData.scoreMatrix;
        TeamManager.updateSessionStatus(session.id, 'assigning');

        // Use Hungarian Algorithm for optimal assignment
        const assignmentResult = Assigner.assignRoles(team, roles, scoringData.scoreMatrix);
        
        if (assignmentResult.success) {
          session.assignment = assignmentResult.assignment!;
          TeamManager.updateSessionStatus(session.id, includeJustifications ? 'justifying' : 'complete');

          assignmentResults.push({
            teamId: team.id,
            sessionId: session.id,
            success: true,
            assignment: assignmentResult.assignment,
            justificationsPending: includeJustifications
          });

          if (includeJustifications) {
            teamsWithAssignments.push({
              team,
              roles,
              assignment: assignmentResult.assignment!,
              sessionId: session.id
            });
          }
        } else {
          TeamManager.updateSessionStatus(session.id, 'pending');
          assignmentResults.push({
            teamId: team.id,
            sessionId: session.id,
            success: false,
            error: `Assignment failed: ${assignmentResult.error}`
          });
        }
      } else {
        TeamManager.updateSessionStatus(session.id, 'pending');
        assignmentResults.push({
          teamId: team.id,
          sessionId: session.id,
          success: false,
          error: `Scoring failed: ${scoringData?.error || 'Unknown error'}`
        });
      }
    }

    // Step 4: Generate justifications in background if requested
    if (includeJustifications && teamsWithAssignments.length > 0) {
      console.log(`Generating justifications for ${teamsWithAssignments.length} teams in background...`);
      
      // Don't await this - let it run in background
      generateBatchJustificationsBackground(
        teamsWithAssignments,
        openRouterApiKey,
        { maxConcurrency, retryFailedRequests }
      );
    }

    // Prepare response
    const successful = assignmentResults.filter(r => r.success).length;
    const failed = assignmentResults.length - successful;
    const withJustifications = includeJustifications ? teamsWithAssignments.length : 0;
    const processingTime = Date.now() - startTime;

    const response: BatchAssignResponse = {
      results: assignmentResults,
      summary: {
        total: assignmentResults.length,
        successful,
        failed,
        withJustifications
      },
      processingTime
    };

    console.log(`Batch assignment completed: ${successful}/${assignmentResults.length} successful in ${processingTime}ms`);

    return res.status(200).json({
      success: successful > 0,
      data: response,
      message: `Batch assignment completed: ${successful}/${assignmentResults.length} teams assigned successfully${includeJustifications ? '. Justifications are being generated in background.' : '.'}`
    });

  } catch (error) {
    console.error('Batch assign teams error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during batch assignment'
    });
  }
}

// Background function to generate justifications for multiple teams
async function generateBatchJustificationsBackground(
  teamsWithAssignments: { team: Team; roles: RoleDefinition[]; assignment: any; sessionId: string }[],
  openRouterApiKey: string,
  options: { maxConcurrency: number; retryFailedRequests: boolean }
) {
  try {
    const teams = teamsWithAssignments.map(t => t.team);
    const rolesArray = teamsWithAssignments.map(t => t.roles);
    const assignments = teamsWithAssignments.map(t => t.assignment);

    console.log(`Starting background justification generation for ${teams.length} teams...`);

    const justificationResult = await Justifier.generateJustificationsBatch(
      teams,
      rolesArray,
      assignments,
      openRouterApiKey,
      options
    );

    // Update sessions with justified assignments
    for (let i = 0; i < teamsWithAssignments.length; i++) {
      const { sessionId } = teamsWithAssignments[i];
      const result = justificationResult.results.find(r => r.teamId === teams[i].id);

      const session = TeamManager.getAssignmentSession(sessionId);
      if (session) {
        if (result?.success && result.updatedAssignment) {
          session.assignment = result.updatedAssignment;
          TeamManager.updateSessionStatus(sessionId, 'complete');
          console.log(`Justifications completed for team ${teams[i].id}`);
        } else {
          console.error(`Justification failed for team ${teams[i].id}:`, result?.error);
          TeamManager.updateSessionStatus(sessionId, 'complete'); // Mark complete even if justifications failed
        }
      }
    }

    console.log(`Background justification generation completed: ${justificationResult.summary.successful}/${justificationResult.summary.total} successful`);

  } catch (error) {
    console.error('Background batch justification error:', error);
    
    // Mark all sessions as complete even if justifications failed
    for (const { sessionId } of teamsWithAssignments) {
      TeamManager.updateSessionStatus(sessionId, 'complete');
    }
  }
}

// Export config for Next.js
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb', // Larger limit for batch requests
    },
    responseLimit: '10mb',
  },
}; 