import type { NextApiRequest, NextApiResponse } from 'next';
import { TeamManager } from '../../lib/teamManager';
import { ApiResponse } from '../../types';

interface ResetTeamRequest {
  teamId: string;
  confirmReset?: boolean; // Safety flag to prevent accidental resets
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ teamId: string; message: string }>>
) {
  // Only allow POST requests for safety
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    const { teamId, confirmReset }: ResetTeamRequest = req.body;

    // Validate required fields
    if (!teamId) {
      return res.status(400).json({
        success: false,
        error: 'Team ID is required'
      });
    }

    // Safety check - require explicit confirmation
    if (!confirmReset) {
      return res.status(400).json({
        success: false,
        error: 'Reset confirmation required. Set confirmReset: true to proceed.'
      });
    }

    // Check if team exists
    const team = TeamManager.getTeam(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    // Store team info before reset for response
    const applicantCount = team.applicants.length;
    const teamName = team.name;

    // Reset the team
    const resetResult = TeamManager.resetTeam(teamId);
    if (!resetResult.success) {
      return res.status(500).json({
        success: false,
        error: resetResult.error || 'Failed to reset team'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        teamId,
        message: `Team "${teamName}" has been reset. Removed ${applicantCount} applicants and all assignment sessions.`
      },
      message: 'Team reset successfully'
    });

  } catch (error) {
    console.error('Reset team error:', error);
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