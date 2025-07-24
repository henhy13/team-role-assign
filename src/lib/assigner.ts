import { munkres } from 'munkres-js';
import { ScoreMatrix, TeamAssignment, Assignment, Team, RoleDefinition } from '../types';

export class Assigner {
  // Assign applicants to roles using Hungarian Algorithm
  static assignRoles(
    team: Team, 
    roles: RoleDefinition[], 
    scoreMatrix: ScoreMatrix
  ): { success: boolean; assignment?: TeamAssignment; error?: string } {
    try {
      if (team.applicants.length !== 10) {
        return { success: false, error: 'Team must have exactly 10 applicants' };
      }

      if (roles.length !== 10) {
        return { success: false, error: 'Must have exactly 10 roles' };
      }

      if (scoreMatrix.scores.length !== 10 || !scoreMatrix.scores.every(row => row.length === 10)) {
        return { success: false, error: 'Score matrix must be 10x10' };
      }

      // Convert scores to cost matrix (Hungarian algorithm minimizes cost)
      // We want to maximize scores, so we subtract from max possible score (100)
      const costMatrix = scoreMatrix.scores.map(row => 
        row.map(score => 100 - score)
      );

      // Run Hungarian algorithm
      const hungarianResult = munkres(costMatrix);

      if (!hungarianResult || hungarianResult.length !== 10) {
        return { success: false, error: 'Hungarian algorithm failed to find valid assignment' };
      }

      // Build assignments
      const assignments: Assignment[] = [];
      let totalScore = 0;

      for (const [applicantIndex, roleIndex] of hungarianResult) {
        if (applicantIndex < 0 || applicantIndex >= 10 || roleIndex < 0 || roleIndex >= 10) {
          return { success: false, error: `Invalid assignment indices: [${applicantIndex}, ${roleIndex}]` };
        }

        const applicant = team.applicants[applicantIndex];
        const role = roles[roleIndex];
        const score = scoreMatrix.scores[applicantIndex][roleIndex];

        if (!applicant) {
          return { success: false, error: `Applicant not found at index ${applicantIndex}` };
        }

        if (!role) {
          return { success: false, error: `Role not found at index ${roleIndex}` };
        }

        assignments.push({
          applicantId: applicant.id,
          roleId: role.id,
          score: score
        });

        totalScore += score;
      }

      // Verify we have exactly 10 unique assignments
      const assignedApplicants = new Set(assignments.map(a => a.applicantId));
      const assignedRoles = new Set(assignments.map(a => a.roleId));

      if (assignedApplicants.size !== 10) {
        return { success: false, error: 'Not all applicants were assigned uniquely' };
      }

      if (assignedRoles.size !== 10) {
        return { success: false, error: 'Not all roles were assigned uniquely' };
      }

      const teamAssignment: TeamAssignment = {
        teamId: team.id,
        assignments,
        totalScore,
        generatedAt: new Date(),
        justificationsGenerated: false
      };

      return { success: true, assignment: teamAssignment };

    } catch (error) {
      return { 
        success: false, 
        error: `Assignment failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // Get assignment details with applicant and role names
  static getAssignmentDetails(
    team: Team, 
    roles: RoleDefinition[], 
    assignment: TeamAssignment
  ): { success: boolean; details?: AssignmentDetail[]; error?: string } {
    try {
      const details: AssignmentDetail[] = [];

      for (const assign of assignment.assignments) {
        const applicant = team.applicants.find(a => a.id === assign.applicantId);
        const role = roles.find(r => r.id === assign.roleId);

        if (!applicant) {
          return { success: false, error: `Applicant with ID ${assign.applicantId} not found` };
        }

        if (!role) {
          return { success: false, error: `Role with ID ${assign.roleId} not found` };
        }

        details.push({
          applicant: {
            id: applicant.id,
            name: applicant.name,
            occupation: applicant.occupation,
            skills: applicant.skills,
            personalityTraits: applicant.personalityTraits
          },
          role: {
            id: role.id,
            name: role.name,
            description: role.description
          },
          score: assign.score,
          justification: assign.justification
        });
      }

      // Sort by score descending for better presentation
      details.sort((a, b) => b.score - a.score);

      return { success: true, details };

    } catch (error) {
      return { 
        success: false, 
        error: `Failed to get assignment details: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // Calculate assignment statistics
  static getAssignmentStats(assignment: TeamAssignment): AssignmentStats {
    const scores = assignment.assignments.map(a => a.score);
    
    return {
      totalScore: assignment.totalScore,
      averageScore: assignment.totalScore / assignment.assignments.length,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      scoreDistribution: this.calculateScoreDistribution(scores)
    };
  }

  // Calculate score distribution in ranges
  private static calculateScoreDistribution(scores: number[]): { range: string; count: number }[] {
    const ranges = [
      { range: '90-100', min: 90, max: 100 },
      { range: '80-89', min: 80, max: 89 },
      { range: '70-79', min: 70, max: 79 },
      { range: '60-69', min: 60, max: 69 },
      { range: '50-59', min: 50, max: 59 },
      { range: '0-49', min: 0, max: 49 }
    ];

    return ranges.map(range => ({
      range: range.range,
      count: scores.filter(score => score >= range.min && score <= range.max).length
    }));
  }

  // Validate assignment integrity
  static validateAssignment(
    team: Team, 
    roles: RoleDefinition[], 
    assignment: TeamAssignment
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check team ID matches
    if (assignment.teamId !== team.id) {
      errors.push('Assignment team ID does not match provided team');
    }

    // Check assignment count
    if (assignment.assignments.length !== 10) {
      errors.push(`Expected 10 assignments, got ${assignment.assignments.length}`);
    }

    // Check for duplicate applicant assignments
    const assignedApplicants = assignment.assignments.map(a => a.applicantId);
    const uniqueApplicants = new Set(assignedApplicants);
    if (uniqueApplicants.size !== assignedApplicants.length) {
      errors.push('Duplicate applicant assignments found');
    }

    // Check for duplicate role assignments
    const assignedRoles = assignment.assignments.map(a => a.roleId);
    const uniqueRoles = new Set(assignedRoles);
    if (uniqueRoles.size !== assignedRoles.length) {
      errors.push('Duplicate role assignments found');
    }

    // Check all applicants are from the team
    for (const assign of assignment.assignments) {
      if (!team.applicants.find(a => a.id === assign.applicantId)) {
        errors.push(`Applicant ${assign.applicantId} not found in team`);
      }
    }

    // Check all roles are valid
    for (const assign of assignment.assignments) {
      if (!roles.find(r => r.id === assign.roleId)) {
        errors.push(`Role ${assign.roleId} not found in roles list`);
      }
    }

    // Check score validity
    for (const assign of assignment.assignments) {
      if (assign.score < 0 || assign.score > 100) {
        errors.push(`Invalid score ${assign.score} for assignment ${assign.applicantId} -> ${assign.roleId}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Helper interfaces for assignment details
export interface AssignmentDetail {
  applicant: {
    id: string;
    name: string;
    occupation: string;
    skills: string[];
    personalityTraits: string[];
  };
  role: {
    id: string;
    name: string;
    description?: string;
  };
  score: number;
  justification?: string;
}

export interface AssignmentStats {
  totalScore: number;
  averageScore: number;
  minScore: number;
  maxScore: number;
  scoreDistribution: { range: string; count: number }[];
} 