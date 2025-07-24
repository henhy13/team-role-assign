import { v4 as uuidv4 } from 'uuid';
import { Session, SessionSettings, SessionStats, SessionSummary, Team, AssignmentSession } from '../types';

// In-memory storage for sessions (replace with database in production)
const sessions = new Map<string, Session>();
const sessionCodes = new Map<string, string>(); // Maps session codes to session IDs

export class SessionManager {
  // Create a new session
  static createSession(
    name: string,
    description: string = '',
    createdBy: string = 'admin',
    settings: Partial<SessionSettings> = {}
  ): Session {
    const defaultSettings: SessionSettings = {
      maxApplicantsPerTeam: 10,
      allowSelfRegistration: true,
      enablePart2: true,
      autoEndAfterAllComplete: false,
      ...settings
    };

    // Generate session code if not provided
    const sessionCode = settings.sessionCode || this.generateSessionCode();

    const session: Session = {
      id: uuidv4(),
      name,
      description,
      status: 'active',
      createdAt: new Date(),
      createdBy,
      settings: {
        ...defaultSettings,
        sessionCode
      },
      stats: {
        totalTeams: 0,
        completeTeams: 0,
        totalApplicants: 0,
        assignedTeams: 0,
        lastActivity: new Date()
      }
    };

    sessions.set(session.id, session);
    if (sessionCode) {
      sessionCodes.set(sessionCode, session.id);
    }

    // Auto-create teams for the session
    createTeamsForSession(session.id, settings.maxTeams || 10);

    console.log(`Session created: "${name}" (${session.id}) with code: ${sessionCode}`);
    return session;
  }

  // Get session by ID
  static getSession(sessionId: string): Session | null {
    return sessions.get(sessionId) || null;
  }

  // Get session by code
  static getSessionByCode(sessionCode: string): Session | null {
    const sessionId = sessionCodes.get(sessionCode);
    return sessionId ? sessions.get(sessionId) || null : null;
  }

  // Get all sessions
  static getAllSessions(): Session[] {
    return Array.from(sessions.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Get active sessions only
  static getActiveSessions(): Session[] {
    return this.getAllSessions().filter(s => s.status === 'active');
  }

  // Update session
  static updateSession(
    sessionId: string,
    updates: {
      name?: string;
      description?: string;
      settings?: Partial<SessionSettings>;
    }
  ): { success: boolean; session?: Session; error?: string } {
    const session = sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status === 'ended') {
      return { success: false, error: 'Cannot update ended session' };
    }

    // Update fields
    if (updates.name) session.name = updates.name;
    if (updates.description !== undefined) session.description = updates.description;
    if (updates.settings) {
      session.settings = { ...session.settings, ...updates.settings };
      
      // Update session code mapping if changed
      if (updates.settings.sessionCode && updates.settings.sessionCode !== session.settings.sessionCode) {
        // Remove old code mapping
        for (const [code, id] of sessionCodes.entries()) {
          if (id === sessionId) {
            sessionCodes.delete(code);
            break;
          }
        }
        // Add new code mapping
        sessionCodes.set(updates.settings.sessionCode, sessionId);
      }
    }

    sessions.set(sessionId, session);
    return { success: true, session };
  }

  // End a session and optionally clear memory
  static endSession(
    sessionId: string,
    options: {
      clearMemory?: boolean;
      exportData?: boolean;
    } = {}
  ): { success: boolean; sessionSummary?: SessionSummary; error?: string } {
    const session = sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status === 'ended') {
      return { success: false, error: 'Session already ended' };
    }

    // Generate session summary before ending
    const summaryResult = this.generateSessionSummary(sessionId);
    const sessionSummary = summaryResult.success ? summaryResult.summary : undefined;

    // Mark as ended
    session.status = 'ended';
    session.endedAt = new Date();
    sessions.set(sessionId, session);

    // Clear session code mapping
    for (const [code, id] of sessionCodes.entries()) {
      if (id === sessionId) {
        sessionCodes.delete(code);
        break;
      }
    }

    console.log(`Session ended: "${session.name}" (${sessionId})`);

    // Clear memory if requested (remove all teams and assignments for this session)
    if (options.clearMemory) {
      this.clearSessionMemory(sessionId);
      console.log(`Memory cleared for session: ${sessionId}`);
    }

    return { success: true, sessionSummary };
  }

  // Archive a session (move to archived status but keep data)
  static archiveSession(sessionId: string): { success: boolean; error?: string } {
    const session = sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.status === 'active') {
      return { success: false, error: 'Cannot archive active session. End it first.' };
    }

    session.status = 'archived';
    sessions.set(sessionId, session);

    return { success: true };
  }

  // Delete a session completely (irreversible)
  static deleteSession(sessionId: string): { success: boolean; error?: string } {
    const session = sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Clear all associated data
    this.clearSessionMemory(sessionId);

    // Remove session code mapping
    for (const [code, id] of sessionCodes.entries()) {
      if (id === sessionId) {
        sessionCodes.delete(code);
        break;
      }
    }

    // Remove session
    sessions.delete(sessionId);

    console.log(`Session deleted: ${sessionId}`);
    return { success: true };
  }

  // Update session statistics
  static updateSessionStats(sessionId: string): { success: boolean; error?: string } {
    const session = sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Import TeamManager dynamically to avoid circular dependency
    const { TeamManager } = require('./teamManager');
    const currentStats = TeamManager.getSessionStats(sessionId);

    // Update session statistics with current data
    session.stats = {
      ...currentStats,
      lastActivity: new Date()
    };
    
    sessions.set(sessionId, session);

    return { success: true };
  }

  // Generate session summary
  static generateSessionSummary(sessionId: string): { success: boolean; summary?: SessionSummary; error?: string } {
    const session = sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Import TeamManager dynamically to avoid circular dependency
    const { TeamManager } = require('./teamManager');
    const teamSummaryData = TeamManager.getSessionSummaryData(sessionId);
    const sessionStats = TeamManager.getSessionStats(sessionId);

    // Calculate average team score
    const teamsWithScores = teamSummaryData.filter((team: any) => team.assignmentScore !== undefined);
    const averageTeamScore = teamsWithScores.length > 0 
      ? teamsWithScores.reduce((sum: number, team: any) => sum + (team.assignmentScore || 0), 0) / teamsWithScores.length 
      : undefined;

    const summary: SessionSummary = {
      sessionId: session.id,
      sessionName: session.name,
      teams: teamSummaryData,
      overallStats: {
        totalParticipants: sessionStats.totalApplicants,
        averageTeamScore,
        completionRate: sessionStats.totalTeams > 0 ? (sessionStats.completeTeams / sessionStats.totalTeams) * 100 : 0
      }
    };

    return { success: true, summary };
  }

  // Clear session memory (remove all teams and assignments)
  private static clearSessionMemory(sessionId: string): void {
    // Import TeamManager dynamically to avoid circular dependency
    const { TeamManager } = require('./teamManager');
    const result = TeamManager.clearSessionData(sessionId);
    
    if (result.success) {
      console.log(`Memory cleared for session ${sessionId}: ${result.cleared?.teams || 0} teams, ${result.cleared?.assignments || 0} assignments`);
    } else {
      console.error(`Failed to clear memory for session ${sessionId}: ${result.error}`);
    }
  }

  // Generate a unique session code
  private static generateSessionCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (sessionCodes.has(code)); // Ensure uniqueness

    return code;
  }

  // Validate session is active and can accept operations
  static validateActiveSession(sessionId: string): { valid: boolean; error?: string } {
    const session = sessions.get(sessionId);
    if (!session) {
      return { valid: false, error: 'Session not found' };
    }

    if (session.status !== 'active') {
      return { valid: false, error: `Session is ${session.status} and cannot accept new operations` };
    }

    return { valid: true };
  }

  // Get session statistics
  static getSessionStats(sessionId: string): { success: boolean; stats?: SessionStats; error?: string } {
    const session = sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    return { success: true, stats: session.stats };
  }

  // Auto-end session if configured and all teams are complete
  static checkAutoEndCondition(sessionId: string): { shouldEnd: boolean; reason?: string } {
    const session = sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return { shouldEnd: false };
    }

    if (!session.settings.autoEndAfterAllComplete) {
      return { shouldEnd: false };
    }

    // Check if all teams have assignments
    if (session.stats.totalTeams > 0 && session.stats.assignedTeams >= session.stats.totalTeams) {
      return { shouldEnd: true, reason: 'All teams have been assigned roles' };
    }

    return { shouldEnd: false };
  }

  // Cleanup old ended sessions (utility for memory management)
  static cleanupOldSessions(daysToKeep: number = 30): { cleaned: number } {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let cleaned = 0;
    for (const [sessionId, session] of sessions.entries()) {
      if (session.status === 'ended' && session.endedAt && session.endedAt < cutoffDate) {
        this.deleteSession(sessionId);
        cleaned++;
      }
    }

    console.log(`Cleaned up ${cleaned} old sessions`);
    return { cleaned };
  }
}

// Helper function to auto-create teams for a session
function createTeamsForSession(sessionId: string, maxTeams: number): void {
  // Import TeamManager dynamically to avoid circular dependency
  const { TeamManager } = require('./teamManager');
  
  // Create teams: Team 1, Team 2, Team 3, etc.
  for (let i = 1; i <= maxTeams; i++) {
    const result = TeamManager.createTeam(`Team ${i}`, sessionId);
    if (!result.success) {
      console.error(`Failed to create Team ${i} for session ${sessionId}: ${result.error}`);
    }
  }
  
  console.log(`Auto-created ${maxTeams} teams for session ${sessionId}`);
} 