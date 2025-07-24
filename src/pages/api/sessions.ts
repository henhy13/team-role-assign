import { NextApiRequest, NextApiResponse } from 'next';
import { SessionManager } from '../../lib/sessionManager';
import { validateRequest, CreateSessionSchema, UpdateSessionSchema } from '../../lib/schema';
import { ApiResponse, Session, CreateSessionRequest, UpdateSessionRequest } from '../../types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Session | Session[]>>
) {
  try {
    switch (req.method) {
      case 'GET':
        return handleGetSessions(req, res);
      case 'POST':
        return handleCreateSession(req, res);
      case 'PUT':
        return handleUpdateSession(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT']);
        return res.status(405).json({
          success: false,
          error: `Method ${req.method} not allowed`
        });
    }
  } catch (error) {
    console.error('Sessions API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

// GET /api/sessions - Get all sessions or filter by status
async function handleGetSessions(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Session[]>>
) {
  const { status } = req.query;
  
  let sessions: Session[];
  
  if (status === 'active') {
    sessions = SessionManager.getActiveSessions();
  } else {
    sessions = SessionManager.getAllSessions();
  }
  
  // Filter by status if provided and not 'active' (which is handled above)
  if (status && status !== 'active') {
    sessions = sessions.filter(s => s.status === status);
  }
  
  return res.status(200).json({
    success: true,
    data: sessions,
    message: `Retrieved ${sessions.length} sessions`
  });
}

// POST /api/sessions - Create a new session
async function handleCreateSession(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Session>>
) {
  const validation = validateRequest(CreateSessionSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error
    });
  }

  const { name, description, settings, createdBy } = validation.data as CreateSessionRequest;

  try {
    const session = SessionManager.createSession(name, description || '', createdBy, settings || {});
    
    return res.status(201).json({
      success: true,
      data: session,
      message: `Session "${name}" created successfully with code: ${session.settings.sessionCode}`
    });
  } catch (error) {
    console.error('Error creating session:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create session'
    });
  }
}

// PUT /api/sessions - Update an existing session
async function handleUpdateSession(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Session>>
) {
  const validation = validateRequest(UpdateSessionSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: validation.error
    });
  }

  const { sessionId, ...updates } = validation.data as UpdateSessionRequest;

  const result = SessionManager.updateSession(sessionId, updates);
  
  if (!result.success) {
    return res.status(404).json({
      success: false,
      error: result.error
    });
  }

  return res.status(200).json({
    success: true,
    data: result.session!,
    message: 'Session updated successfully'
  });
} 