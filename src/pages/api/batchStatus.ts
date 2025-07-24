import type { NextApiRequest, NextApiResponse } from 'next';
import { TeamManager } from '../../lib/teamManager';
import { Assigner, AssignmentDetail } from '../../lib/assigner';
import { ApiResponse, AssignmentSession } from '../../types';

interface BatchStatusRequest {
  teamIds?: string[];
  sessionIds?: string[];
  includeDetails?: boolean;
  includeStats?: boolean;
}

interface TeamStatusResult {
  teamId: string;
  teamName: string;
  session?: AssignmentSession;
  assignmentDetails?: AssignmentDetail[];
  stats?: {
    totalScore: number;
    averageScore: number;
    minScore: number;
    maxScore: number;
    scoreDistribution: { range: string; count: number }[];
  };
  error?: string;
}

interface BatchStatusResponse {
  results: TeamStatusResult[];
  summary: {
    total: number;
    pending: number;
    scoring: number;
    assigning: number;
    justifying: number;
    complete: number;
    errors: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<BatchStatusResponse>>
) {
  // Allow GET and POST requests
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    let requestData: BatchStatusRequest;

    // Handle different request methods
    if (req.method === 'GET') {
      const { teamIds, sessionIds, includeDetails, includeStats } = req.query;
      requestData = {
        teamIds: teamIds ? (Array.isArray(teamIds) ? teamIds : [teamIds]) as string[] : undefined,
        sessionIds: sessionIds ? (Array.isArray(sessionIds) ? sessionIds : [sessionIds]) as string[] : undefined,
        includeDetails: includeDetails === 'true',
        includeStats: includeStats === 'true'
      };
    } else {
      requestData = req.body;
    }

    const {
      teamIds,
      sessionIds,
      includeDetails = false,
      includeStats = false
    } = requestData;

    if (!teamIds && !sessionIds) {
      return res.status(400).json({
        success: false,
        error: 'Either teamIds or sessionIds must be provided'
      });
    }

    const results: TeamStatusResult[] = [];
    const statusCounts = {
      pending: 0,
      scoring: 0,
      assigning: 0,
      justifying: 0,
      complete: 0,
      errors: 0
    };

    // Process team IDs if provided
    if (teamIds && teamIds.length > 0) {
      await Promise.all(teamIds.map(async (teamId) => {
        try {
          const team = TeamManager.getTeam(teamId);
          if (!team) {
            results.push({
              teamId,
              teamName: 'Unknown',
              error: 'Team not found'
            });
            statusCounts.errors++;
            return;
          }

          // Get latest session for team
          const session = TeamManager.getLatestSessionForTeam(teamId);
          if (!session) {
            results.push({
              teamId,
              teamName: team.name,
              error: 'No assignment sessions found'
            });
            statusCounts.errors++;
            return;
          }

          const result: TeamStatusResult = {
            teamId,
            teamName: team.name,
            session
          };

          // Include detailed assignment information if requested
          if (includeDetails && session.assignment && session.status !== 'pending') {
            const detailsResult = Assigner.getAssignmentDetails(team, session.roles, session.assignment);
            if (detailsResult.success) {
              result.assignmentDetails = detailsResult.details;
            }
          }

          // Include statistics if requested
          if (includeStats && session.assignment) {
            result.stats = Assigner.getAssignmentStats(session.assignment);
          }

          results.push(result);
          statusCounts[session.status as keyof typeof statusCounts]++;

        } catch (error) {
          results.push({
            teamId,
            teamName: 'Unknown',
            error: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
          statusCounts.errors++;
        }
      }));
    }

    // Process session IDs if provided
    if (sessionIds && sessionIds.length > 0) {
      await Promise.all(sessionIds.map(async (sessionId) => {
        try {
          const session = TeamManager.getAssignmentSession(sessionId);
          if (!session) {
            results.push({
              teamId: 'unknown',
              teamName: 'Unknown',
              error: 'Session not found'
            });
            statusCounts.errors++;
            return;
          }

          const team = TeamManager.getTeam(session.teamId);
          if (!team) {
            results.push({
              teamId: session.teamId,
              teamName: 'Unknown',
              session,
              error: 'Associated team not found'
            });
            statusCounts.errors++;
            return;
          }

          const result: TeamStatusResult = {
            teamId: session.teamId,
            teamName: team.name,
            session
          };

          // Include detailed assignment information if requested
          if (includeDetails && session.assignment && session.status !== 'pending') {
            const detailsResult = Assigner.getAssignmentDetails(team, session.roles, session.assignment);
            if (detailsResult.success) {
              result.assignmentDetails = detailsResult.details;
            }
          }

          // Include statistics if requested
          if (includeStats && session.assignment) {
            result.stats = Assigner.getAssignmentStats(session.assignment);
          }

          results.push(result);
          statusCounts[session.status as keyof typeof statusCounts]++;

        } catch (error) {
          results.push({
            teamId: 'unknown',
            teamName: 'Unknown',
            error: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
          statusCounts.errors++;
        }
      }));
    }

    const response: BatchStatusResponse = {
      results,
      summary: {
        total: results.length,
        ...statusCounts
      }
    };

    // Determine appropriate message based on statuses
    let message = `Retrieved status for ${results.length} team(s).`;
    
    if (statusCounts.scoring > 0 || statusCounts.assigning > 0 || statusCounts.justifying > 0) {
      const processing = statusCounts.scoring + statusCounts.assigning + statusCounts.justifying;
      message += ` ${processing} assignment(s) still processing.`;
    }
    
    if (statusCounts.complete > 0) {
      message += ` ${statusCounts.complete} assignment(s) complete.`;
    }
    
    if (statusCounts.errors > 0) {
      message += ` ${statusCounts.errors} error(s) encountered.`;
    }

    return res.status(200).json({
      success: true,
      data: response,
      message
    });

  } catch (error) {
    console.error('Batch status error:', error);
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
      sizeLimit: '2mb',
    },
  },
}; 