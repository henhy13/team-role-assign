import type { NextApiRequest, NextApiResponse } from 'next';
import { TeamManager } from '../../lib/teamManager';
import { validateRequest, SubmitApplicantSchema } from '../../lib/schema';
import { ApiResponse, SubmitApplicantRequest, Applicant } from '../../types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ applicant: Applicant; teamComplete: boolean }>>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed'
    });
  }

  try {
    // Validate request body
    const validation = validateRequest(SubmitApplicantSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const { sessionId, teamId, applicant: applicantData } = validation.data;

    // Check if team exists
    const team = TeamManager.getTeam(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    // Add applicant to team
    const result = TeamManager.addApplicant(teamId, applicantData);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // Get updated team to check if complete
    const updatedTeam = TeamManager.getTeam(teamId);
    
    return res.status(201).json({
      success: true,
      data: {
        applicant: result.applicant!,
        teamComplete: updatedTeam?.isComplete || false
      },
      message: updatedTeam?.isComplete 
        ? 'Applicant added successfully. Team is now complete and ready for assignment!' 
        : `Applicant added successfully. Team has ${updatedTeam?.applicants.length || 0}/10 members.`
    });

  } catch (error) {
    console.error('Submit applicant error:', error);
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