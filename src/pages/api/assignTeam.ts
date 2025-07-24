import type { NextApiRequest, NextApiResponse } from 'next';
import { TeamManager } from '../../lib/teamManager';
import { Scorer } from '../../lib/scorer';
import { Assigner } from '../../lib/assigner';
import { Justifier } from '../../lib/justifier';
import { validateRequest, AssignTeamSchema } from '../../lib/schema';
import { ApiResponse, AssignTeamRequest, TeamAssignment } from '../../types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ sessionId: string; assignment: TeamAssignment; justificationsPending: boolean }>>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    // Get OpenRouter API key from environment
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return res.status(500).json({
        success: false,
        error: 'OpenRouter API key not configured'
      });
    }

    // Validate request body
    const validation = validateRequest(AssignTeamSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const { teamId, phase, customRoles } = validation.data;

    // Check if team exists and is complete
    const team = TeamManager.getTeam(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    if (!team.isComplete) {
      return res.status(400).json({
        success: false,
        error: 'Team must have exactly 10 applicants before assignment'
      });
    }

    // Create assignment session
    const sessionResult = TeamManager.createAssignmentSession(teamId, phase, customRoles);
    if (!sessionResult.success) {
      return res.status(400).json({
        success: false,
        error: sessionResult.error
      });
    }

    const session = sessionResult.session!;

    try {
      // Update session status to scoring
      TeamManager.updateSessionStatus(session.id, 'scoring');

      // Step 1: Generate score matrix using AI
      console.log(`Generating score matrix for team ${teamId}...`);
      const scoringResult = await Scorer.generateScoreMatrix(team, session.roles, openRouterApiKey);
      
      if (!scoringResult.success) {
        TeamManager.updateSessionStatus(session.id, 'pending');
        return res.status(500).json({
          success: false,
          error: `Scoring failed: ${scoringResult.error}`
        });
      }

      // Update session with score matrix
      session.scoreMatrix = scoringResult.scoreMatrix!;
      TeamManager.updateSessionStatus(session.id, 'assigning');

      // Step 2: Use Hungarian Algorithm for optimal assignment
      console.log(`Assigning roles for team ${teamId}...`);
      const assignmentResult = Assigner.assignRoles(team, session.roles, session.scoreMatrix);
      
      if (!assignmentResult.success) {
        TeamManager.updateSessionStatus(session.id, 'pending');
        return res.status(500).json({
          success: false,
          error: `Assignment failed: ${assignmentResult.error}`
        });
      }

      // Update session with assignment
      session.assignment = assignmentResult.assignment!;
      TeamManager.updateSessionStatus(session.id, 'justifying');

      // Return immediate response with assignments
      const immediateResponse = res.status(200).json({
        success: true,
        data: {
          sessionId: session.id,
          assignment: session.assignment,
          justificationsPending: true
        },
        message: 'Team assigned successfully! AI justifications are being generated...'
      });

      // Step 3: Generate justifications in the background (don't await)
      generateJustificationsBackground(session.id, team, session.roles, session.assignment, openRouterApiKey);

      return immediateResponse;

    } catch (error) {
      // Mark session as failed
      TeamManager.updateSessionStatus(session.id, 'pending');
      throw error;
    }

  } catch (error) {
    console.error('Assign team error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during assignment'
    });
  }
}

// Background function to generate justifications
async function generateJustificationsBackground(
  sessionId: string,
  team: any,
  roles: any[],
  assignment: any,
  openRouterApiKey: string
) {
  try {
    console.log(`Generating justifications for session ${sessionId}...`);
    
    const justificationResult = await Justifier.generateJustifications(
      team,
      roles,
      assignment,
      openRouterApiKey
    );

    if (justificationResult.success) {
      // Update session with justified assignment
      const session = TeamManager.getAssignmentSession(sessionId);
      if (session) {
        session.assignment = justificationResult.updatedAssignment!;
        TeamManager.updateSessionStatus(sessionId, 'complete');
        console.log(`Justifications completed for session ${sessionId}`);
      }
    } else {
      console.error(`Justification failed for session ${sessionId}:`, justificationResult.error);
      // Mark as complete even if justifications failed - assignment is still valid
      TeamManager.updateSessionStatus(sessionId, 'complete');
    }

  } catch (error) {
    console.error(`Background justification error for session ${sessionId}:`, error);
    // Mark as complete even if justifications failed
    TeamManager.updateSessionStatus(sessionId, 'complete');
  }
}

// Export config for Next.js
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}; 