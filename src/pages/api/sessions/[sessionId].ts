import { NextApiRequest, NextApiResponse } from 'next';
import { SessionManager } from '../../../lib/sessionManager';
import { ApiResponse, Session, SessionSummary } from '../../../types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Session | SessionSummary | { message: string }>>
) {
  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Session ID is required'
    });
  }

  try {
    switch (req.method) {
      case 'GET':
        return handleGetSession(sessionId, req, res);
      case 'POST':
        return handleSessionAction(sessionId, req, res);
      case 'DELETE':
        return handleDeleteSession(sessionId, req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).json({
          success: false,
          error: `Method ${req.method} not allowed`
        });
    }
  } catch (error) {
    console.error('Session API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

// GET /api/sessions/[sessionId] - Get session details
async function handleGetSession(
  sessionId: string,
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Session>>
) {
  const session = SessionManager.getSession(sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  return res.status(200).json({
    success: true,
    data: session
  });
}

// POST /api/sessions/[sessionId] - Handle session actions (end, archive)
async function handleSessionAction(
  sessionId: string,
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SessionSummary | { message: string }>>
) {
  const { action, confirmEnd, clearMemory, exportData } = req.body;

  switch (action) {
    case 'end':
      if (!confirmEnd) {
        return res.status(400).json({
          success: false,
          error: 'Must confirm session end by setting confirmEnd: true'
        });
      }

      const endResult = SessionManager.endSession(sessionId, {
        clearMemory: clearMemory === true,
        exportData: exportData === true
      });

      if (!endResult.success) {
        return res.status(400).json({
          success: false,
          error: endResult.error
        });
      }

      return res.status(200).json({
        success: true,
        data: endResult.sessionSummary!,
        message: `Session ended${clearMemory ? ' and memory cleared' : ''}`
      });

    case 'archive':
      const archiveResult = SessionManager.archiveSession(sessionId);
      
      if (!archiveResult.success) {
        return res.status(400).json({
          success: false,
          error: archiveResult.error
        });
      }

      return res.status(200).json({
        success: true,
        data: { message: 'Session archived successfully' },
        message: 'Session has been archived'
      });

    default:
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Supported actions: end, archive'
      });
  }
}

// DELETE /api/sessions/[sessionId] - Delete session completely
async function handleDeleteSession(
  sessionId: string,
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ message: string }>>
) {
  const result = SessionManager.deleteSession(sessionId);
  
  if (!result.success) {
    return res.status(404).json({
      success: false,
      error: result.error
    });
  }

  return res.status(200).json({
    success: true,
    data: { message: 'Session deleted successfully' },
    message: 'Session and all associated data have been permanently deleted'
  });
} 