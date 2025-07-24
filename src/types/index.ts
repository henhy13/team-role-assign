export interface Applicant {
  id: string;
  name: string;
  occupation: string;
  skills: string[];
  personalityTraits: string[];
  submittedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  applicants: Applicant[];
  createdAt: Date;
  isComplete: boolean; // true when has 10 applicants
  sessionId: string; // Link to session
}

export interface RoleDefinition {
  id: string;
  name: string; // e.g., "Role #1", "Role #2", etc.
  description?: string; // Optional for future use
}

export interface ScoreMatrix {
  teamId: string;
  scores: number[][]; // 10x10 matrix: scores[applicantIndex][roleIndex]
  generatedAt: Date;
}

export interface Assignment {
  applicantId: string;
  roleId: string;
  score: number;
  justification?: string; // AI-generated explanation
}

export interface TeamAssignment {
  teamId: string;
  assignments: Assignment[];
  totalScore: number;
  generatedAt: Date;
  justificationsGenerated: boolean;
}

export interface AssignmentSession {
  id: string;
  teamId: string;
  phase: 'part1' | 'part2';
  roles: RoleDefinition[];
  scoreMatrix?: ScoreMatrix;
  assignment?: TeamAssignment;
  status: 'pending' | 'scoring' | 'assigning' | 'justifying' | 'complete';
  createdAt: Date;
}

// NEW: Session Management Types
export interface Session {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'ended' | 'archived';
  createdAt: Date;
  endedAt?: Date;
  createdBy: string; // Admin/dev identifier
  settings: SessionSettings;
  stats: SessionStats;
}

export interface SessionSettings {
  maxTeams?: number; // Limit number of teams (default: unlimited)
  maxApplicantsPerTeam: number; // Default: 10
  allowSelfRegistration: boolean; // Can users create their own teams
  enablePart2: boolean; // Enable Part 2 custom roles
  autoEndAfterAllComplete: boolean; // Auto-end when all teams assigned
  sessionCode?: string; // Optional join code for participants
}

export interface SessionStats {
  totalTeams: number;
  completeTeams: number;
  totalApplicants: number;
  assignedTeams: number;
  lastActivity: Date;
}

export interface SessionSummary {
  sessionId: string;
  sessionName: string;
  teams: Array<{
    teamId: string;
    teamName: string;
    memberCount: number;
    isComplete: boolean;
    hasAssignment: boolean;
    assignmentScore?: number;
  }>;
  overallStats: {
    totalParticipants: number;
    averageTeamScore?: number;
    completionRate: number;
  };
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SubmitApplicantRequest {
  sessionId: string; // NEW: Session context
  teamId: string;
  applicant: Omit<Applicant, 'id' | 'submittedAt'>;
}

export interface AssignTeamRequest {
  teamId: string;
  phase?: 'part1' | 'part2';
  customRoles?: string[]; // For part2, custom role names
}

// NEW: Session Management API Types
export interface CreateSessionRequest {
  name: string;
  description?: string;
  settings?: Partial<SessionSettings>;
  createdBy: string;
}

export interface UpdateSessionRequest {
  sessionId: string;
  name?: string;
  description?: string;
  settings?: Partial<SessionSettings>;
}

export interface EndSessionRequest {
  sessionId: string;
  confirmEnd: boolean;
  exportData?: boolean; // Whether to export session data before ending
}

export interface JoinSessionRequest {
  sessionCode?: string;
  sessionId?: string;
}

// OpenRouter API types
export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
} 