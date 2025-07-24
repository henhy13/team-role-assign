'use client';

import { useState, useEffect } from 'react';
import { Team } from '../../types';

interface TeamWithStats extends Team {
  stats: {
    totalApplicants: number;
    isComplete: boolean;
    skills: string[];
    occupations: string[];
  };
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  const [newTeamName, setNewTeamName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Load teams on mount
  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const response = await fetch('/api/teams');
      const data = await response.json();
      
      if (data.success) {
        setTeams(data.data);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to load teams');
      console.error('Load teams error:', error);
    }
  };

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName.trim() })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage(`Team "${newTeamName}" created successfully!`);
        setNewTeamName('');
        setShowCreateForm(false);
        await loadTeams();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to create team');
      console.error('Create team error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamDetails = async (teamId: string) => {
    try {
      const response = await fetch(`/api/teams?teamId=${teamId}`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedTeam(data.data);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to load team details');
      console.error('Load team details error:', error);
    }
  };

  const assignTeamRoles = async (teamId: string, phase: 'part1' | 'part2' = 'part1') => {
    setAssigning(teamId);
    setMessage('Starting role assignment...');

    try {
      const response = await fetch('/api/assignTeam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, phase })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage(`${data.message} Session ID: ${data.data.sessionId}`);
      } else {
        setMessage(`Assignment failed: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to assign team roles');
      console.error('Assign team error:', error);
    } finally {
      setAssigning(null);
    }
  };

  const resetTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to reset this team? This will remove all applicants and assignments.')) {
      return;
    }

    try {
      const response = await fetch('/api/resetTeam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, confirmReset: true })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage(data.message);
        setSelectedTeam(null);
        await loadTeams();
      } else {
        setMessage(`Reset failed: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to reset team');
      console.error('Reset team error:', error);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Team Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            View submitted teams and trigger role assignments when teams are complete (10 members).
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn-primary"
          >
            Create New Team
          </button>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className="mt-4 p-4 rounded-md bg-blue-50 border border-blue-200">
          <p className="text-sm text-blue-800">{message}</p>
        </div>
      )}

      {/* Create Team Form */}
      {showCreateForm && (
        <div className="mt-6 card">
          <div className="card-header">
            <h3 className="text-lg font-medium">Create New Team</h3>
          </div>
          <div className="card-body">
            <form onSubmit={createTeam} className="space-y-4">
              <div>
                <label className="form-label">Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="form-input"
                  placeholder="Enter team name..."
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teams List */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {teams.map((team) => (
          <div key={team.id} className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">{team.name}</h3>
                <span className={`status-badge ${team.isComplete ? 'status-complete' : 'status-pending'}`}>
                  {team.isComplete ? 'Complete' : `${team.applicants.length}/10`}
                </span>
              </div>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  <p><strong>Members:</strong> {team.applicants.length}/10</p>
                  <p><strong>Created:</strong> {new Date(team.createdAt).toLocaleDateString()}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => loadTeamDetails(team.id)}
                    className="btn-secondary text-xs"
                  >
                    View Details
                  </button>
                  
                  {team.isComplete && (
                    <>
                      <button
                        onClick={() => assignTeamRoles(team.id, 'part1')}
                        disabled={assigning === team.id}
                        className="btn-primary text-xs"
                      >
                        {assigning === team.id ? 'Assigning...' : 'Assign Roles (Part 1)'}
                      </button>
                      <button
                        onClick={() => assignTeamRoles(team.id, 'part2')}
                        disabled={assigning === team.id}
                        className="btn-secondary text-xs"
                      >
                        Part 2 Assignment
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={() => resetTeam(team.id)}
                    className="btn-danger text-xs"
                  >
                    Reset Team
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Team Details Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">{selectedTeam.name} - Details</h3>
              <button
                onClick={() => setSelectedTeam(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Total Applicants:</strong> {selectedTeam.stats.totalApplicants}/10
                </div>
                <div>
                  <strong>Status:</strong> {selectedTeam.stats.isComplete ? 'Complete' : 'Incomplete'}
                </div>
              </div>

              <div>
                <strong>Applicants:</strong>
                <div className="mt-2 space-y-2">
                  {selectedTeam.applicants.map((applicant, index) => (
                    <div key={applicant.id} className="p-3 bg-gray-50 rounded-md">
                      <div className="font-medium">{index + 1}. {applicant.name}</div>
                      <div className="text-sm text-gray-600">
                        <p><strong>Occupation:</strong> {applicant.occupation}</p>
                        <p><strong>Skills:</strong> {applicant.skills.join(', ')}</p>
                        <p><strong>Traits:</strong> {applicant.personalityTraits.join(', ')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTeam.stats.skills.length > 0 && (
                <div>
                  <strong>Team Skills Summary:</strong>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedTeam.stats.skills.map((skill, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {teams.length === 0 && (
        <div className="mt-8 text-center py-12">
          <div className="text-gray-500">
            <p className="text-lg">No teams created yet</p>
            <p className="text-sm mt-2">Create your first team to get started</p>
          </div>
        </div>
      )}
    </div>
  );
} 