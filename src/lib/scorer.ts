import { Team, ScoreMatrix, OpenRouterRequest, OpenRouterResponse, RoleDefinition } from '../types';

export class Scorer {
  private static readonly OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  private static readonly DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second base delay

  // Generate scoring matrix for a single team
  static async generateScoreMatrix(
    team: Team, 
    roles: RoleDefinition[], 
    openRouterApiKey: string
  ): Promise<{ success: boolean; scoreMatrix?: ScoreMatrix; error?: string }> {
    return this.generateScoreMatrixWithRetry(team, roles, openRouterApiKey, 0);
  }

  // Batch generate scoring matrices for multiple teams using Promise.all
  static async generateScoreMatricesBatch(
    teams: Team[],
    rolesArray: RoleDefinition[][],
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
      scoreMatrix?: ScoreMatrix;
      error?: string;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  }> {
    const { maxConcurrency = 10, retryFailedRequests = true } = options;

    if (teams.length !== rolesArray.length) {
      return {
        success: false,
        results: [],
        summary: { total: 0, successful: 0, failed: 0 }
      };
    }

    // Create batches to respect concurrency limits
    const batches = this.createBatches(teams, maxConcurrency);
    const rolesBatches = this.createBatches(rolesArray, maxConcurrency);
    
    const allResults: Array<{
      teamId: string;
      success: boolean;
      scoreMatrix?: ScoreMatrix;
      error?: string;
    }> = [];

    // Process batches sequentially, but items within each batch in parallel
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const rolesBatch = rolesBatches[i];

      console.log(`Processing scoring batch ${i + 1}/${batches.length} with ${batch.length} teams`);

      // Use Promise.allSettled to handle failures gracefully
      const batchPromises = batch.map((team, index) => 
        this.generateScoreMatrixWithRetry(team, rolesBatch[index], openRouterApiKey, 0)
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
      if (i < batches.length - 1) {
        await this.delay(500);
      }
    }

    // Retry failed requests if enabled
    if (retryFailedRequests) {
      const failedResults = allResults.filter(r => !r.success);
      if (failedResults.length > 0) {
        console.log(`Retrying ${failedResults.length} failed scoring requests...`);
        
        const retryPromises = failedResults.map(async (failedResult) => {
          const team = teams.find(t => t.id === failedResult.teamId);
          const rolesIndex = teams.findIndex(t => t.id === failedResult.teamId);
          
          if (team && rolesIndex >= 0) {
            await this.delay(Math.random() * 2000); // Random delay to spread load
            return this.generateScoreMatrixWithRetry(team, rolesArray[rolesIndex], openRouterApiKey, 0)
              .then(result => ({ teamId: team.id, ...result }))
              .catch(error => ({
                teamId: team.id,
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

  // Generate score matrix with retry logic
  private static async generateScoreMatrixWithRetry(
    team: Team, 
    roles: RoleDefinition[], 
    openRouterApiKey: string,
    retryCount: number
  ): Promise<{ success: boolean; scoreMatrix?: ScoreMatrix; error?: string }> {
    try {
      if (team.applicants.length !== 10) {
        return { success: false, error: 'Team must have exactly 10 applicants' };
      }

      if (roles.length !== 10) {
        return { success: false, error: 'Must have exactly 10 roles' };
      }

      const prompt = this.buildScoringPrompt(team, roles);
      
      const request: OpenRouterRequest = {
        model: this.DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert team formation analyst. You will analyze applicant profiles and score how well each person fits different team roles. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
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
      let parsedScores: number[][];
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error('No JSON array found in response');
        }
        parsedScores = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        throw new Error(`Failed to parse LLM response: ${parseError}`);
      }

      // Validate the matrix dimensions and values
      if (!Array.isArray(parsedScores) || parsedScores.length !== 10) {
        throw new Error('Score matrix must be 10x10');
      }

      for (let i = 0; i < 10; i++) {
        if (!Array.isArray(parsedScores[i]) || parsedScores[i].length !== 10) {
          throw new Error(`Row ${i} must have exactly 10 scores`);
        }
        for (let j = 0; j < 10; j++) {
          const score = parsedScores[i][j];
          if (typeof score !== 'number' || score < 0 || score > 100) {
            throw new Error(`Invalid score at [${i}][${j}]: must be number between 0-100`);
          }
        }
      }

      const scoreMatrix: ScoreMatrix = {
        teamId: team.id,
        scores: parsedScores,
        generatedAt: new Date()
      };

      return { success: true, scoreMatrix };

    } catch (error) {
      const isRetryable = this.isRetryableError(error);
      
      if (isRetryable && retryCount < this.MAX_RETRIES) {
        const delay = this.RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
        console.log(`Retrying scoring for team ${team.id} (attempt ${retryCount + 1}/${this.MAX_RETRIES}) after ${delay}ms...`);
        
        await this.delay(delay);
        return this.generateScoreMatrixWithRetry(team, roles, openRouterApiKey, retryCount + 1);
      }

      return { 
        success: false, 
        error: `Scoring failed after ${retryCount} retries: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // Build the prompt for LLM scoring (optimized for batch processing)
  private static buildScoringPrompt(team: Team, roles: RoleDefinition[]): string {
    const applicantsText = team.applicants.map((applicant, index) => 
      `Applicant ${index + 1}: ${applicant.name}
      Occupation: ${applicant.occupation}
      Skills: ${applicant.skills.join(', ')}
      Personality Traits: ${applicant.personalityTraits.join(', ')}`
    ).join('\n\n');

    const rolesText = roles.map((role, index) => 
      `${role.name} (Position ${index + 1})`
    ).join('\n');

    return `Please analyze the following team applicants and score how well each person would fit into each of the 10 roles. 

APPLICANTS:
${applicantsText}

ROLES TO FILL:
${rolesText}

INSTRUCTIONS:
1. Score each applicant (1-10) against each role (1-10) on a scale of 0-100
2. Consider their occupation, skills, and personality traits
3. Higher scores mean better fit for that role
4. Be thoughtful about complementary skills and team dynamics
5. Ensure scoring is fair and considers diverse strengths

Please respond with ONLY a 10x10 JSON array where:
- Each row represents an applicant (Applicant 1, Applicant 2, ..., Applicant 10)
- Each column represents a role (Role 1, Role 2, ..., Role 10)  
- Each cell contains a score from 0-100

Example format:
[
  [85, 70, 92, 60, 75, 80, 65, 90, 55, 78],
  [75, 85, 60, 95, 70, 65, 88, 55, 80, 72],
  ...
]

Your response should contain ONLY the JSON array, no other text.`;
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

  // Validate score matrix format
  static validateScoreMatrix(scores: unknown): scores is number[][] {
    if (!Array.isArray(scores) || scores.length !== 10) {
      return false;
    }

    return scores.every(row => 
      Array.isArray(row) && 
      row.length === 10 && 
      row.every(score => 
        typeof score === 'number' && 
        score >= 0 && 
        score <= 100
      )
    );
  }

  // Performance monitoring
  static async generateScoreMatrixWithMetrics(
    team: Team, 
    roles: RoleDefinition[], 
    openRouterApiKey: string
  ): Promise<{
    success: boolean;
    scoreMatrix?: ScoreMatrix;
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
      apiKey: string, 
      currentRetry: number
    ): Promise<{ success: boolean; scoreMatrix?: ScoreMatrix; error?: string }> => {
      maxRetryCount = Math.max(maxRetryCount, currentRetry);
      return this.generateScoreMatrixWithRetry(teamParam, rolesParam, apiKey, currentRetry);
    };

    const result = await generateWithTracking(team, roles, openRouterApiKey, 0);
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