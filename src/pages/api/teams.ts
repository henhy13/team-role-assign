import type { NextApiRequest, NextApiResponse } from 'next';
import { TeamManager } from '../../lib/teamManager';
import { ApiResponse, Team } from '../../types';

interface TeamWithStats extends Team {
  stats: {
    totalApplicants: number;
    isComplete: boolean;
    skills: string[];
    occupations: string[];
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Team | TeamWithStats | Team[]>>
) {
  try {
    switch (req.method) {
      case 'GET':
        return handleGetTeams(req, res);
      // Team creation is now automatic when sessions are created
      default:
        return res.status(405).json({
          success: false,
          error: 'Method Not Allowed'
        });
    }
  } catch (error) {
    console.error('Teams API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

// Handle GET requests - list all teams or get specific team
async function handleGetTeams(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Team | TeamWithStats | Team[]>>
) {
  const { teamId } = req.query;

  if (teamId) {
    // Get specific team with stats
    if (typeof teamId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid team ID'
      });
    }

    const team = TeamManager.getTeam(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    const statsResult = TeamManager.getTeamStats(teamId);
    if (!statsResult.success) {
      return res.status(500).json({
        success: false,
        error: statsResult.error
      });
    }

    const teamWithStats: TeamWithStats = {
      ...team,
      stats: statsResult.stats!
    };

    return res.status(200).json({
      success: true,
      data: teamWithStats,
      message: `Team "${team.name}" retrieved successfully`
    });
  } else {
    // List all teams
    const teams = TeamManager.getAllTeams();
    
    return res.status(200).json({
      success: true,
      data: teams,
      message: `Retrieved ${teams.length} team(s)`
    });
  }
}

// Team creation is now handled automatically when sessions are created
// Teams are named "Team 1", "Team 2", etc. based on session settings

// Export config for Next.js
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}; 