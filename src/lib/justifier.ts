import { Team, RoleDefinition, TeamAssignment, Assignment, OpenRouterRequest, OpenRouterResponse } from '../types';

export class Justifier {
  private static readonly OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  private static readonly DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second base delay

  // Generate justifications for a single team
  static async generateJustifications(
    team: Team,
    roles: RoleDefinition[],
    assignment: TeamAssignment,
    openRouterApiKey: string
  ): Promise<{ success: boolean; updatedAssignment?: TeamAssignment; error?: string }> {
    return this.generateJustificationsWithRetry(team, roles, assignment, openRouterApiKey, 0);
  }

  // Batch generate justifications for multiple teams using Promise.all
  static async generateJustificationsBatch(
    teams: Team[],
    rolesArray: RoleDefinition[][],
    assignments: TeamAssignment[],
    openRouterApiKey: string,
    options: {
      maxConcurrency?: number;
      retryFailedRequests?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    results: Array<{
      teamId: string;
      success: boolean;
      updatedAssignment?: TeamAssignment;
      error?: string;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  }> {
    const { maxConcurrency = 10, retryFailedRequests = true } = options;

    if (teams.length !== rolesArray.length || teams.length !== assignments.length) {
      return {
        success: false,
        results: [],
        summary: { total: 0, successful: 0, failed: 0 }
      };
    }

    // Create batches to respect concurrency limits
    const teamBatches = this.createBatches(teams, maxConcurrency);
    const rolesBatches = this.createBatches(rolesArray, maxConcurrency);
    const assignmentBatches = this.createBatches(assignments, maxConcurrency);
    
    const allResults: Array<{
      teamId: string;
      success: boolean;
      updatedAssignment?: TeamAssignment;
      error?: string;
    }> = [];

    // Process batches sequentially, but items within each batch in parallel
    for (let i = 0; i < teamBatches.length; i++) {
      const teamBatch = teamBatches[i];
      const rolesBatch = rolesBatches[i];
      const assignmentBatch = assignmentBatches[i];

      console.log(`Processing justification batch ${i + 1}/${teamBatches.length} with ${teamBatch.length} teams`);

      // Use Promise.allSettled to handle failures gracefully
      const batchPromises = teamBatch.map((team, index) => 
        this.generateJustificationsWithRetry(
          team, 
          rolesBatch[index], 
          assignmentBatch[index], 
          openRouterApiKey, 
          0
        )
          .then(result => ({
            teamId: team.id,
            ...result
          }))
          .catch(error => ({
            teamId: team.id,
            success: false,
            error: `Batch processing error: ${error.message}`
          }))
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          allResults.push(result.value);
        } else {
          allResults.push({
            teamId: 'unknown',
            success: false,
            error: `Promise failed: ${result.reason}`
          });
        }
      }

      // Add delay between batches to avoid rate limiting
      if (i < teamBatches.length - 1) {
        await this.delay(500);
      }
    }

    // Retry failed requests if enabled
    if (retryFailedRequests) {
      const failedResults = allResults.filter(r => !r.success);
      if (failedResults.length > 0) {
        console.log(`Retrying ${failedResults.length} failed justification requests...`);
        
        const retryPromises = failedResults.map(async (failedResult) => {
          const teamIndex = teams.findIndex(t => t.id === failedResult.teamId);
          
          if (teamIndex >= 0) {
            await this.delay(Math.random() * 2000); // Random delay to spread load
            return this.generateJustificationsWithRetry(
              teams[teamIndex],
              rolesArray[teamIndex],
              assignments[teamIndex],
              openRouterApiKey,
              0
            )
              .then(result => ({ teamId: teams[teamIndex].id, ...result }))
              .catch(error => ({
                teamId: teams[teamIndex].id,
                success: false,
                error: `Retry failed: ${error.message}`
              }));
          }
          return failedResult;
        });

        const retryResults = await Promise.allSettled(retryPromises);
        
        // Update results with retry outcomes
        retryResults.forEach((retryResult, index) => {
          if (retryResult.status === 'fulfilled') {
            const originalIndex = allResults.findIndex(r => r.teamId === failedResults[index].teamId);
            if (originalIndex >= 0) {
              allResults[originalIndex] = retryResult.value;
            }
          }
        });
      }
    }

    const successful = allResults.filter(r => r.success).length;
    const failed = allResults.length - successful;

    return {
      success: successful > 0,
      results: allResults,
      summary: {
        total: allResults.length,
        successful,
        failed
      }
    };
  }

  // Generate justifications with retry logic
  private static async generateJustificationsWithRetry(
    team: Team,
    roles: RoleDefinition[],
    assignment: TeamAssignment,
    openRouterApiKey: string,
    retryCount: number
  ): Promise<{ success: boolean; updatedAssignment?: TeamAssignment; error?: string }> {
    try {
      if (assignment.assignments.length !== 10) {
        throw new Error('Assignment must have exactly 10 assignments');
      }

      const prompt = this.buildJustificationPrompt(team, roles, assignment);

      const request: OpenRouterRequest = {
        model: this.DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert team formation analyst. You will provide brief, insightful justifications for role assignments based on applicant profiles and team dynamics. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 3000
      };

      const response = await fetch(this.OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://team-role-assign.vercel.app',
          'X-Title': 'Team Role Assignment System'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data: OpenRouterResponse = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response content from LLM');
      }

      // Parse the JSON response
      let parsedJustifications: JustificationResponse[];
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error('No JSON array found in response');
        }
        parsedJustifications = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        throw new Error(`Failed to parse LLM response: ${parseError}`);
      }

      // Validate the response format
      if (!Array.isArray(parsedJustifications) || parsedJustifications.length !== 10) {
        throw new Error('Must have exactly 10 justifications');
      }

      // Create a map for quick lookup by applicant ID
      const justificationMap = new Map<string, string>();
      
      for (const justification of parsedJustifications) {
        if (!justification.applicantId || !justification.justification) {
          throw new Error('Invalid justification format: missing applicantId or justification');
        }
        
        if (typeof justification.justification !== 'string' || justification.justification.length > 500) {
          throw new Error('Justification must be a string under 500 characters');
        }

        justificationMap.set(justification.applicantId, justification.justification.trim());
      }

      // Update assignments with justifications
      const updatedAssignments: Assignment[] = assignment.assignments.map(assign => {
        const justification = justificationMap.get(assign.applicantId);
        if (!justification) {
          throw new Error(`No justification found for applicant ${assign.applicantId}`);
        }

        return {
          ...assign,
          justification
        };
      });

      const updatedAssignment: TeamAssignment = {
        ...assignment,
        assignments: updatedAssignments,
        justificationsGenerated: true
      };

      return { success: true, updatedAssignment };

    } catch (error) {
      const isRetryable = this.isRetryableError(error);
      
      if (isRetryable && retryCount < this.MAX_RETRIES) {
        const delay = this.RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
        console.log(`Retrying justification for team ${team.id} (attempt ${retryCount + 1}/${this.MAX_RETRIES}) after ${delay}ms...`);
        
        await this.delay(delay);
        return this.generateJustificationsWithRetry(team, roles, assignment, openRouterApiKey, retryCount + 1);
      }

      return { 
        success: false, 
        error: `Justification generation failed after ${retryCount} retries: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // Build the prompt for LLM justification
  private static buildJustificationPrompt(
    team: Team, 
    roles: RoleDefinition[], 
    assignment: TeamAssignment
  ): string {
    // Build assignment details for context
    const assignmentDetails = assignment.assignments.map(assign => {
      const applicant = team.applicants.find(a => a.id === assign.applicantId);
      const role = roles.find(r => r.id === assign.roleId);
      
      if (!applicant || !role) {
        throw new Error('Invalid assignment: applicant or role not found');
      }

      return {
        applicantId: applicant.id,
        applicantName: applicant.name,
        occupation: applicant.occupation,
        skills: applicant.skills,
        personalityTraits: applicant.personalityTraits,
        roleName: role.name,
        score: assign.score
      };
    });

    // Sort by score for better context
    assignmentDetails.sort((a, b) => b.score - a.score);

    const assignmentsText = assignmentDetails.map(detail => 
      `${detail.applicantName} → ${detail.roleName} (Score: ${detail.score})
      Profile: ${detail.occupation} | Skills: ${detail.skills.join(', ')} | Traits: ${detail.personalityTraits.join(', ')}`
    ).join('\n\n');

    return `Please provide brief justifications (1-2 sentences each) for the following role assignments. Focus on why each person is well-suited for their assigned role based on their skills, occupation, and personality traits.

ASSIGNMENTS:
${assignmentsText}

INSTRUCTIONS:
1. Write 1-2 sentences explaining why each assignment makes sense
2. Focus on the specific match between the person's profile and their role
3. Consider complementary skills and team dynamics where relevant
4. Keep each justification under 200 characters
5. Be positive and constructive

Please respond with ONLY a JSON array containing objects with 'applicantId' and 'justification' fields:

Example format:
[
  {
    "applicantId": "uuid-here",
    "justification": "Their strong analytical skills and finance background make them perfect for handling data-driven decisions and strategic planning."
  },
  {
    "applicantId": "uuid-here", 
    "justification": "Natural leadership qualities combined with excellent communication skills align perfectly with coordinating team efforts."
  },
  ...
]

Your response should contain ONLY the JSON array, no other text.`;
  }

  // Generate a single justification (for individual updates) with retry
  static async generateSingleJustification(
    applicant: { id: string; name: string; occupation: string; skills: string[]; personalityTraits: string[] },
    role: { id: string; name: string; description?: string },
    score: number,
    openRouterApiKey: string
  ): Promise<{ success: boolean; justification?: string; error?: string }> {
    return this.generateSingleJustificationWithRetry(applicant, role, score, openRouterApiKey, 0);
  }

  private static async generateSingleJustificationWithRetry(
    applicant: { id: string; name: string; occupation: string; skills: string[]; personalityTraits: string[] },
    role: { id: string; name: string; description?: string },
    score: number,
    openRouterApiKey: string,
    retryCount: number
  ): Promise<{ success: boolean; justification?: string; error?: string }> {
    try {
      const prompt = `Please provide a brief justification (1-2 sentences) for why this person is well-suited for this role.

PERSON: ${applicant.name}
Occupation: ${applicant.occupation}
Skills: ${applicant.skills.join(', ')}
Personality Traits: ${applicant.personalityTraits.join(', ')}

ASSIGNED ROLE: ${role.name}
Match Score: ${score}/100

Please explain why this assignment makes sense based on their profile. Keep it under 200 characters and be positive and constructive.

Respond with just the justification text, no JSON or formatting.`;

      const request: OpenRouterRequest = {
        model: this.DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert team formation analyst. Provide brief, insightful justifications for role assignments.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 200
      };

      const response = await fetch(this.OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://team-role-assign.vercel.app',
          'X-Title': 'Team Role Assignment System'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data: OpenRouterResponse = await response.json();
      const justification = data.choices[0]?.message?.content?.trim();

      if (!justification) {
        throw new Error('No justification content from LLM');
      }

      if (justification.length > 500) {
        throw new Error('Justification too long (max 500 characters)');
      }

      return { success: true, justification };

    } catch (error) {
      const isRetryable = this.isRetryableError(error);
      
      if (isRetryable && retryCount < this.MAX_RETRIES) {
        const delay = this.RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`Retrying single justification (attempt ${retryCount + 1}/${this.MAX_RETRIES}) after ${delay}ms...`);
        
        await this.delay(delay);
        return this.generateSingleJustificationWithRetry(applicant, role, score, openRouterApiKey, retryCount + 1);
      }

      return { 
        success: false, 
        error: `Single justification generation failed after ${retryCount} retries: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // Utility methods for batch processing
  private static createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const isNetworkError = errorMessage.includes('network') || 
                          errorMessage.includes('timeout') || 
                          errorMessage.includes('fetch');
    
    const isRateLimited = errorMessage.includes('rate limit') || 
                         errorMessage.includes('429') ||
                         errorMessage.includes('too many requests');
    
    const isServerError = errorMessage.includes('500') || 
                         errorMessage.includes('502') || 
                         errorMessage.includes('503') || 
                         errorMessage.includes('504');

    return isNetworkError || isRateLimited || isServerError;
  }

  // Validate justifications format
  static validateJustifications(justifications: unknown): justifications is JustificationResponse[] {
    if (!Array.isArray(justifications)) {
      return false;
    }

    return justifications.every(item => 
      item && 
      typeof item === 'object' &&
      'applicantId' in item &&
      'justification' in item &&
      typeof item.applicantId === 'string' &&
      typeof item.justification === 'string' &&
      item.justification.length <= 500
    );
  }

  // Update specific assignment justification
  static updateAssignmentJustification(
    assignment: TeamAssignment,
    applicantId: string,
    justification: string
  ): { success: boolean; updatedAssignment?: TeamAssignment; error?: string } {
    if (justification.length > 500) {
      return { success: false, error: 'Justification too long (max 500 characters)' };
    }

    const assignmentIndex = assignment.assignments.findIndex(a => a.applicantId === applicantId);
    if (assignmentIndex === -1) {
      return { success: false, error: 'Applicant not found in assignment' };
    }

    const updatedAssignments = [...assignment.assignments];
    updatedAssignments[assignmentIndex] = {
      ...updatedAssignments[assignmentIndex],
      justification: justification.trim()
    };

    const updatedAssignment: TeamAssignment = {
      ...assignment,
      assignments: updatedAssignments,
      justificationsGenerated: updatedAssignments.every(a => !!a.justification)
    };

    return { success: true, updatedAssignment };
  }

  // Performance monitoring for justifications
  static async generateJustificationsWithMetrics(
    team: Team,
    roles: RoleDefinition[],
    assignment: TeamAssignment,
    openRouterApiKey: string
  ): Promise<{
    success: boolean;
    updatedAssignment?: TeamAssignment;
    error?: string;
    metrics: {
      startTime: number;
      endTime: number;
      duration: number;
      retryCount: number;
    };
  }> {
    const startTime = Date.now();
    let maxRetryCount = 0;

    // Custom retry function that tracks attempts
    const generateWithTracking = async (
      teamParam: Team,
      rolesParam: RoleDefinition[],
      assignmentParam: TeamAssignment,
      apiKey: string,
      currentRetry: number
    ): Promise<{ success: boolean; updatedAssignment?: TeamAssignment; error?: string }> => {
      maxRetryCount = Math.max(maxRetryCount, currentRetry);
      return this.generateJustificationsWithRetry(teamParam, rolesParam, assignmentParam, apiKey, currentRetry);
    };

    const result = await generateWithTracking(team, roles, assignment, openRouterApiKey, 0);
    const endTime = Date.now();

    return {
      ...result,
      metrics: {
        startTime,
        endTime,
        duration: endTime - startTime,
        retryCount: maxRetryCount
      }
    };
  }
}

// Helper interface for justification API response
interface JustificationResponse {
  applicantId: string;
  justification: string;
} 