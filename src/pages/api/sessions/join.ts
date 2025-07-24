import { NextApiRequest, NextApiResponse } from 'next';
import { SessionManager } from '../../../lib/sessionManager';
import { validateRequest } from '../../../lib/schema';
import { ApiResponse, Session, JoinSessionRequest } from '../../../types';
import { z } from 'zod';

const JoinSessionSchema = z.object({
  sessionCode: z.string().optional(),
  sessionId: z.string().optional(),
}).refine(
  (data) => data.sessionCode || data.sessionId,
  {
    message: "Either sessionCode or sessionId must be provided",
  }
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Session>>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} not allowed`
    });
  }

  try {
    const validation = validateRequest(JoinSessionSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const { sessionCode, sessionId } = validation.data as JoinSessionRequest;

    let session: Session | null = null;

    // Try to find session by code first, then by ID
    if (sessionCode) {
      session = SessionManager.getSessionByCode(sessionCode);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Invalid session code'
        });
      }
    } else if (sessionId) {
      session = SessionManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }
    }

    // Check if session is active
    if (session!.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Session is ${session!.status} and not accepting new participants`
      });
    }

    return res.status(200).json({
      success: true,
      data: session!,
      message: `Successfully joined session: ${session!.name}`
    });

  } catch (error) {
    console.error('Join session error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
} 