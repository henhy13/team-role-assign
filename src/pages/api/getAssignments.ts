import type { NextApiRequest, NextApiResponse } from 'next';
import { TeamManager } from '../../lib/teamManager';
import { Assigner, AssignmentDetail } from '../../lib/assigner';
import { ApiResponse, AssignmentSession } from '../../types';

interface GetAssignmentsResponse {
  session: AssignmentSession;
  assignmentDetails?: AssignmentDetail[];
  stats?: {
    totalScore: number;
    averageScore: number;
    minScore: number;
    maxScore: number;
    scoreDistribution: { range: string; count: number }[];
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<GetAssignmentsResponse>>
) {
  // Allow GET and POST requests
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    let teamId: string;
    let sessionId: string | undefined;

    // Handle different request methods
    if (req.method === 'GET') {
      teamId = req.query.teamId as string;
      sessionId = req.query.sessionId as string;
    } else {
      teamId = req.body.teamId;
      sessionId = req.body.sessionId;
    }

    if (!teamId) {
      return res.status(400).json({
        success: false,
        error: 'Team ID is required'
      });
    }

    // Validate team exists
    const team = TeamManager.getTeam(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    // Get assignment session
    let session: AssignmentSession | null;
    
    if (sessionId) {
      session = TeamManager.getAssignmentSession(sessionId);
      if (!session || session.teamId !== teamId) {
        return res.status(404).json({
          success: false,
          error: 'Assignment session not found'
        });
      }
    } else {
      // Get latest session for team
      session = TeamManager.getLatestSessionForTeam(teamId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'No assignment sessions found for this team'
        });
      }
    }

    // Prepare response data
    const responseData: GetAssignmentsResponse = {
      session
    };

    // If assignment is complete, include detailed information
    if (session.assignment && session.status !== 'pending') {
      // Get assignment details with names
      const detailsResult = Assigner.getAssignmentDetails(team, session.roles, session.assignment);
      
      if (detailsResult.success) {
        responseData.assignmentDetails = detailsResult.details;
        responseData.stats = Assigner.getAssignmentStats(session.assignment);
      }
    }

    // Determine appropriate message based on status
    let message: string;
    switch (session.status) {
      case 'pending':
        message = 'Assignment session created but not started';
        break;
      case 'scoring':
        message = 'AI is analyzing applicants and generating compatibility scores...';
        break;
      case 'assigning':
        message = 'Optimizing role assignments using Hungarian Algorithm...';
        break;
      case 'justifying':
        message = 'Assignment complete! Generating AI justifications...';
        break;
      case 'complete':
        const hasJustifications = session.assignment?.justificationsGenerated;
        message = hasJustifications 
          ? 'Assignment complete with AI justifications!'
          : 'Assignment complete! (Justifications may still be processing)';
        break;
      default:
        message = 'Assignment status unknown';
    }

    return res.status(200).json({
      success: true,
      data: responseData,
      message
    });

  } catch (error) {
    console.error('Get assignments error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
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