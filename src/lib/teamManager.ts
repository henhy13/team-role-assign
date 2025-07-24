import { v4 as uuidv4 } from 'uuid';
import { Team, Applicant, AssignmentSession, RoleDefinition } from '../types';
import { SessionManager } from './sessionManager';
import { DEFAULT_ROLES } from './schema';

// In-memory storage (replace with database in production) - now session-scoped
const teams = new Map<string, Team>();
const sessions = new Map<string, AssignmentSession>();

export class TeamManager {
  // Create a new team (now requires sessionId)
  static createTeam(name: string, sessionId: string): { success: boolean; team?: Team; error?: string } {
    // Validate session is active
    const sessionValidation = SessionManager.validateActiveSession(sessionId);
    if (!sessionValidation.valid) {
      return { success: false, error: sessionValidation.error };
    }

    const team: Team = {
      id: uuidv4(),
      name,
      applicants: [],
      createdAt: new Date(),
      isComplete: false,
      sessionId,
    };
    
    teams.set(team.id, team);
    
    // Update session stats
    SessionManager.updateSessionStats(sessionId);
    
    return { success: true, team };
  }

  // Get team by ID
  static getTeam(teamId: string): Team | null {
    return teams.get(teamId) || null;
  }

  // Get all teams (optionally filtered by session)
  static getAllTeams(sessionId?: string): Team[] {
    const allTeams = Array.from(teams.values());
    return sessionId ? allTeams.filter(team => team.sessionId === sessionId) : allTeams;
  }

  // Get teams for a specific session
  static getTeamsForSession(sessionId: string): Team[] {
    return Array.from(teams.values()).filter(team => team.sessionId === sessionId);
  }

  // Add applicant to team (with session validation)
  static addApplicant(teamId: string, applicantData: Omit<Applicant, 'id' | 'submittedAt'>): { success: boolean; applicant?: Applicant; error?: string } {
    const team = teams.get(teamId);
    if (!team) {
      return { success: false, error: 'Team not found' };
    }

    // Validate session is still active
    const sessionValidation = SessionManager.validateActiveSession(team.sessionId);
    if (!sessionValidation.valid) {
      return { success: false, error: `Cannot add applicant: ${sessionValidation.error}` };
    }

    if (team.applicants.length >= 10) {
      return { success: false, error: 'Team is already full (10 applicants maximum)' };
    }

    // Check for duplicate names in the same team
    if (team.applicants.some(a => a.name.toLowerCase() === applicantData.name.toLowerCase())) {
      return { success: false, error: 'An applicant with this name already exists in the team' };
    }

    const applicant: Applicant = {
      id: uuidv4(),
      ...applicantData,
      submittedAt: new Date(),
    };

    team.applicants.push(applicant);
    team.isComplete = team.applicants.length === 10;
    
    teams.set(teamId, team);
    
    // Update session stats
    SessionManager.updateSessionStats(team.sessionId);
    
    return { success: true, applicant };
  }

  // Remove applicant from team
  static removeApplicant(teamId: string, applicantId: string): { success: boolean; error?: string } {
    const team = teams.get(teamId);
    if (!team) {
      return { success: false, error: 'Team not found' };
    }

    // Validate session is still active
    const sessionValidation = SessionManager.validateActiveSession(team.sessionId);
    if (!sessionValidation.valid) {
      return { success: false, error: `Cannot remove applicant: ${sessionValidation.error}` };
    }

    const applicantIndex = team.applicants.findIndex(a => a.id === applicantId);
    if (applicantIndex === -1) {
      return { success: false, error: 'Applicant not found in team' };
    }

    team.applicants.splice(applicantIndex, 1);
    team.isComplete = team.applicants.length === 10;
    
    teams.set(teamId, team);
    
    // Update session stats
    SessionManager.updateSessionStats(team.sessionId);
    
    return { success: true };
  }

  // Create assignment session
  static createAssignmentSession(teamId: string, phase: 'part1' | 'part2' = 'part1', customRoles?: string[]): { success: boolean; session?: AssignmentSession; error?: string } {
    const team = teams.get(teamId);
    if (!team) {
      return { success: false, error: 'Team not found' };
    }

    // Validate parent session is still active
    const sessionValidation = SessionManager.validateActiveSession(team.sessionId);
    if (!sessionValidation.valid) {
      return { success: false, error: `Cannot create assignment: ${sessionValidation.error}` };
    }

    if (!team.isComplete) {
      return { success: false, error: 'Team must have exactly 10 applicants before assignment' };
    }

    // Create role definitions
    let roles: RoleDefinition[];
    if (phase === 'part2' && customRoles) {
      if (customRoles.length !== 10) {
        return { success: false, error: 'Must provide exactly 10 custom roles for part 2' };
      }
      roles = customRoles.map((name, index) => ({
        id: uuidv4(),
        name: name.trim() || `Role #${index + 1}`,
      }));
    } else {
      roles = DEFAULT_ROLES.map((name, index) => ({
        id: uuidv4(),
        name,
      }));
    }

    const session: AssignmentSession = {
      id: uuidv4(),
      teamId,
      phase,
      roles,
      status: 'pending',
      createdAt: new Date(),
    };

    sessions.set(session.id, session);
    
    return { success: true, session };
  }

  // Get assignment session
  static getAssignmentSession(sessionId: string): AssignmentSession | null {
    return sessions.get(sessionId) || null;
  }

  // Get latest assignment session for team
  static getLatestSessionForTeam(teamId: string): AssignmentSession | null {
    const teamSessions = Array.from(sessions.values())
      .filter(s => s.teamId === teamId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return teamSessions[0] || null;
  }

  // Update session status
  static updateSessionStatus(sessionId: string, status: AssignmentSession['status']): { success: boolean; error?: string } {
    const session = sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    session.status = status;
    sessions.set(sessionId, session);
    
    return { success: true };
  }

  // Reset team (remove all applicants) - with session validation
  static resetTeam(teamId: string): { success: boolean; error?: string } {
    const team = teams.get(teamId);
    if (!team) {
      return { success: false, error: 'Team not found' };
    }

    // Validate session is still active (only active sessions can be reset)
    const sessionValidation = SessionManager.validateActiveSession(team.sessionId);
    if (!sessionValidation.valid) {
      return { success: false, error: `Cannot reset team: ${sessionValidation.error}` };
    }

    team.applicants = [];
    team.isComplete = false;
    teams.set(teamId, team);

    // Also remove any associated assignment sessions
    const teamSessions = Array.from(sessions.entries())
      .filter(([_, session]) => session.teamId === teamId);
    
    teamSessions.forEach(([sessionId, _]) => {
      sessions.delete(sessionId);
    });

    // Update session stats
    SessionManager.updateSessionStats(team.sessionId);

    return { success: true };
  }

  // Delete team completely - with session validation
  static deleteTeam(teamId: string): { success: boolean; error?: string } {
    const team = teams.get(teamId);
    if (!team) {
      return { success: false, error: 'Team not found' };
    }

    // Validate session is still active (only active sessions can have teams deleted)
    const sessionValidation = SessionManager.validateActiveSession(team.sessionId);
    if (!sessionValidation.valid) {
      return { success: false, error: `Cannot delete team: ${sessionValidation.error}` };
    }

    teams.delete(teamId);

    // Also remove any associated assignment sessions
    const teamSessions = Array.from(sessions.entries())
      .filter(([_, session]) => session.teamId === teamId);
    
    teamSessions.forEach(([sessionId, _]) => {
      sessions.delete(sessionId);
    });

    // Update session stats
    SessionManager.updateSessionStats(team.sessionId);

    return { success: true };
  }

  // Get team statistics
  static getTeamStats(teamId: string): { success: boolean; stats?: { totalApplicants: number; isComplete: boolean; skills: string[]; occupations: string[] }; error?: string } {
    const team = teams.get(teamId);
    if (!team) {
      return { success: false, error: 'Team not found' };
    }

    const allSkills = team.applicants.flatMap(a => a.skills);
    const uniqueSkills = [...new Set(allSkills)];
    const uniqueOccupations = [...new Set(team.applicants.map(a => a.occupation))];

    return {
      success: true,
      stats: {
        totalApplicants: team.applicants.length,
        isComplete: team.isComplete,
        skills: uniqueSkills,
        occupations: uniqueOccupations,
      }
    };
  }

  // NEW: Session-scoped operations for memory management

  // Clear all teams and assignments for a specific session
  static clearSessionData(sessionId: string): { success: boolean; cleared?: { teams: number; assignments: number }; error?: string } {
    try {
      // Remove all teams for this session
      const sessionTeams = Array.from(teams.entries()).filter(([_, team]) => team.sessionId === sessionId);
      const teamIds = sessionTeams.map(([teamId, _]) => teamId);
      
      let teamsCleared = 0;
      for (const teamId of teamIds) {
        teams.delete(teamId);
        teamsCleared++;
      }

      // Remove all assignment sessions for these teams
      const assignmentSessionsToRemove = Array.from(sessions.entries()).filter(([_, session]) => teamIds.includes(session.teamId));
      let assignmentsCleared = 0;
      for (const [assignmentSessionId, _] of assignmentSessionsToRemove) {
        sessions.delete(assignmentSessionId);
        assignmentsCleared++;
      }

      console.log(`Cleared session data: ${teamsCleared} teams, ${assignmentsCleared} assignments for session ${sessionId}`);
      
      return { 
        success: true, 
        cleared: { 
          teams: teamsCleared, 
          assignments: assignmentsCleared 
        } 
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to clear session data: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // Get session statistics for integration with SessionManager
  static getSessionStats(sessionId: string): { 
    totalTeams: number; 
    completeTeams: number; 
    totalApplicants: number; 
    assignedTeams: number 
  } {
    const sessionTeams = this.getTeamsForSession(sessionId);
    const completeTeams = sessionTeams.filter(team => team.isComplete).length;
    const totalApplicants = sessionTeams.reduce((sum, team) => sum + team.applicants.length, 0);
    
    // Count teams with assignments
    const assignedTeams = sessionTeams.filter(team => {
      const latestSession = this.getLatestSessionForTeam(team.id);
      return latestSession && latestSession.assignment;
    }).length;

    return {
      totalTeams: sessionTeams.length,
      completeTeams,
      totalApplicants,
      assignedTeams
    };
  }

  // Validate team belongs to session
  static validateTeamSession(teamId: string, expectedSessionId: string): { valid: boolean; error?: string } {
    const team = teams.get(teamId);
    if (!team) {
      return { valid: false, error: 'Team not found' };
    }

    if (team.sessionId !== expectedSessionId) {
      return { valid: false, error: 'Team does not belong to the specified session' };
    }

    return { valid: true };
  }

  // Get session summary data for a specific session
  static getSessionSummaryData(sessionId: string) {
    const sessionTeams = this.getTeamsForSession(sessionId);
    
    return sessionTeams.map(team => {
      const latestAssignment = this.getLatestSessionForTeam(team.id);
      return {
        teamId: team.id,
        teamName: team.name,
        memberCount: team.applicants.length,
        isComplete: team.isComplete,
        hasAssignment: !!(latestAssignment && latestAssignment.assignment),
        assignmentScore: latestAssignment?.assignment?.totalScore
      };
    });
  }
} 