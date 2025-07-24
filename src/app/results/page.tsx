'use client';

import { useState, useEffect } from 'react';
import { Team, AssignmentSession } from '../../types';

interface AssignmentDetail {
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

interface AssignmentData {
  session: AssignmentSession;
  assignmentDetails?: AssignmentDetail[];
  stats?: {
    totalScore: number;
    averageScore: number;
    minScore: number;
    maxScore: number;
    scoreDistribution: { range: string; count: number }[];
  };
}

export default function ResultsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [assignmentData, setAssignmentData] = useState<AssignmentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [message, setMessage] = useState<string>('');

  // Load teams on mount
  useEffect(() => {
    loadTeams();
  }, []);

  // Auto-refresh assignment data when justifications are being generated
  useEffect(() => {
    if (assignmentData?.session.status === 'justifying' || polling) {
      const interval = setInterval(() => {
        if (selectedTeamId) {
          loadAssignments(selectedTeamId, true);
        }
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [assignmentData?.session.status, polling, selectedTeamId]);

  const loadTeams = async () => {
    try {
      const response = await fetch('/api/teams');
      const data = await response.json();
      
      if (data.success) {
        const completeTeams = data.data.filter((team: Team) => team.isComplete);
        setTeams(completeTeams);
        
        // Auto-select first complete team
        if (completeTeams.length > 0 && !selectedTeamId) {
          setSelectedTeamId(completeTeams[0].id);
        }
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to load teams');
      console.error('Load teams error:', error);
    }
  };

  const loadAssignments = async (teamId: string, isPolling = false) => {
    if (!isPolling) {
      setLoading(true);
      setMessage('Loading assignment results...');
    }

    try {
      const response = await fetch('/api/getAssignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId })
      });

      const data = await response.json();
      
      if (data.success) {
        setAssignmentData(data.data);
        setMessage(data.message);
        
        // Stop polling if assignment is complete
        if (data.data.session.status === 'complete') {
          setPolling(false);
        }
      } else {
        setAssignmentData(null);
        setMessage(`No assignments found: ${data.error}`);
      }
    } catch (error) {
      if (!isPolling) {
        setMessage('Failed to load assignments');
        console.error('Load assignments error:', error);
      }
    } finally {
      if (!isPolling) {
        setLoading(false);
      }
    }
  };

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    setAssignmentData(null);
    setPolling(false);
    if (teamId) {
      loadAssignments(teamId);
    }
  };

  const getScoreClassName = (score: number) => {
    if (score >= 90) return 'score-excellent';
    if (score >= 80) return 'score-good';
    if (score >= 70) return 'score-average';
    return 'score-poor';
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'scoring': return 'status-scoring';
      case 'assigning': return 'status-assigning';
      case 'justifying': return 'status-justifying';
      case 'complete': return 'status-complete';
      default: return 'status-pending';
    }
  };

  const startPolling = () => {
    setPolling(true);
    if (selectedTeamId) {
      loadAssignments(selectedTeamId);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Assignment Results</h1>
          <p className="mt-2 text-sm text-gray-700">
            View role assignments and AI-generated justifications for completed teams.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={startPolling}
            disabled={!selectedTeamId || loading}
            className="btn-secondary"
          >
            Refresh Results
          </button>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className="mt-4 p-4 rounded-md bg-blue-50 border border-blue-200">
          <p className="text-sm text-blue-800">{message}</p>
        </div>
      )}

      {/* Team Selection */}
      <div className="mt-6 card">
        <div className="card-header">
          <h3 className="text-lg font-medium">Select Team</h3>
        </div>
        <div className="card-body">
          <div>
            <label className="form-label">Choose Team to View Results</label>
            <select
              value={selectedTeamId}
              onChange={(e) => handleTeamChange(e.target.value)}
              className="form-input"
            >
              <option value="">Select a team...</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} (10/10 members)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Assignment Results */}
      {assignmentData && (
        <div className="mt-8 space-y-6">
          {/* Session Status */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Assignment Status</h3>
                <span className={`status-badge ${getStatusBadgeClass(assignmentData.session.status)}`}>
                  {assignmentData.session.status.charAt(0).toUpperCase() + assignmentData.session.status.slice(1)}
                </span>
              </div>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <strong>Phase:</strong> {assignmentData.session.phase === 'part1' ? 'Part 1' : 'Part 2'}
                </div>
                <div>
                  <strong>Session ID:</strong> {assignmentData.session.id.slice(0, 8)}...
                </div>
                <div>
                  <strong>Created:</strong> {new Date(assignmentData.session.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Assignment Statistics */}
          {assignmentData.stats && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium">Assignment Statistics</h3>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{assignmentData.stats.totalScore}</div>
                    <div className="text-gray-600">Total Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{assignmentData.stats.averageScore.toFixed(1)}</div>
                    <div className="text-gray-600">Average Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{assignmentData.stats.minScore}</div>
                    <div className="text-gray-600">Min Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{assignmentData.stats.maxScore}</div>
                    <div className="text-gray-600">Max Score</div>
                  </div>
                </div>

                {/* Score Distribution */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Score Distribution</h4>
                  <div className="grid grid-cols-6 gap-2 text-xs">
                    {assignmentData.stats.scoreDistribution.map((dist) => (
                      <div key={dist.range} className="text-center">
                        <div className="bg-gray-100 rounded p-2">
                          <div className="font-bold">{dist.count}</div>
                          <div className="text-gray-600">{dist.range}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Role Assignments */}
          {assignmentData.assignmentDetails && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium">Role Assignments</h3>
                <p className="text-sm text-gray-600">
                  Optimized assignments using Hungarian Algorithm for maximum team compatibility
                </p>
              </div>
              <div className="card-body">
                <div className="space-y-4">
                  {assignmentData.assignmentDetails.map((detail, index) => (
                    <div key={detail.applicant.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-semibold">{detail.applicant.name}</span>
                            <span className="text-sm text-gray-600">→</span>
                            <span className="font-medium text-blue-600">{detail.role.name}</span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {detail.applicant.occupation}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xl font-bold ${getScoreClassName(detail.score)}`}>
                            {detail.score}
                          </div>
                          <div className="text-xs text-gray-600">Compatibility</div>
                        </div>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <strong>Skills:</strong> {detail.applicant.skills.join(', ')}
                        </div>
                        <div>
                          <strong>Traits:</strong> {detail.applicant.personalityTraits.join(', ')}
                        </div>
                      </div>

                      {detail.justification ? (
                        <div className="mt-3 p-3 bg-blue-50 rounded-md">
                          <div className="text-sm">
                            <strong className="text-blue-800">AI Justification:</strong>
                            <p className="mt-1 text-blue-700">{detail.justification}</p>
                          </div>
                        </div>
                      ) : assignmentData.session.status === 'justifying' ? (
                        <div className="mt-3 p-3 bg-yellow-50 rounded-md">
                          <div className="text-sm text-yellow-700">
                            <strong>Justification:</strong> Being generated by AI...
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 p-3 bg-gray-100 rounded-md">
                          <div className="text-sm text-gray-600">
                            <strong>Justification:</strong> Not yet generated
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Loading States */}
          {(assignmentData.session.status === 'scoring' || assignmentData.session.status === 'assigning') && (
            <div className="card">
              <div className="card-body text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">
                  {assignmentData.session.status === 'scoring' ? 
                    'AI is analyzing team members and generating compatibility scores...' :
                    'Optimizing role assignments using Hungarian Algorithm...'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Teams State */}
      {teams.length === 0 && (
        <div className="mt-8 text-center py-12">
          <div className="text-gray-500">
            <p className="text-lg">No complete teams found</p>
            <p className="text-sm mt-2">Teams need 10 members before assignments can be viewed</p>
          </div>
        </div>
      )}

      {/* No Assignment State */}
      {selectedTeamId && !assignmentData && !loading && (
        <div className="mt-8 text-center py-12">
          <div className="text-gray-500">
            <p className="text-lg">No assignments found for this team</p>
            <p className="text-sm mt-2">Go to the Teams page to trigger role assignment</p>
          </div>
        </div>
      )}
    </div>
  );
} 