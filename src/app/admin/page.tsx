'use client';

import { useState, useEffect } from 'react';
import { Session, SessionSummary } from '../../types';

interface CreateSessionForm {
  name: string;
  description: string;
  maxTeams: number;
  maxApplicantsPerTeam: number;
  sessionCode: string;
  allowSelfRegistration: boolean;
  enablePart2: boolean;
  autoEndAfterAllComplete: boolean;
}

export default function AdminDashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [createForm, setCreateForm] = useState<CreateSessionForm>({
    name: '',
    description: '',
    maxTeams: 10,
    maxApplicantsPerTeam: 10,
    sessionCode: '',
    allowSelfRegistration: true,
    enablePart2: true,
    autoEndAfterAllComplete: false,
  });

  // Load sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sessions');
      const data = await response.json();
      
      if (data.success) {
        setSessions(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to load sessions');
      }
    } catch (err) {
      setError('Network error while loading sessions');
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('create');

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description,
          createdBy: 'Admin', // In production, this would be from auth
          settings: {
            maxTeams: createForm.maxTeams,
            maxApplicantsPerTeam: createForm.maxApplicantsPerTeam,
            sessionCode: createForm.sessionCode || undefined,
            allowSelfRegistration: createForm.allowSelfRegistration,
            enablePart2: createForm.enablePart2,
            autoEndAfterAllComplete: createForm.autoEndAfterAllComplete,
          },
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setShowCreateForm(false);
        setCreateForm({
          name: '',
          description: '',
          maxTeams: 10,
          maxApplicantsPerTeam: 10,
          sessionCode: '',
          allowSelfRegistration: true,
          enablePart2: true,
          autoEndAfterAllComplete: false,
        });
        await fetchSessions();
        alert(`Session created successfully!\nCode: ${data.data.settings.sessionCode}`);
      } else {
        setError(data.error || 'Failed to create session');
      }
    } catch (err) {
      setError('Network error while creating session');
      console.error('Error creating session:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const endSession = async (sessionId: string) => {
    const confirmEnd = window.confirm(
      'Are you sure you want to end this session? This action cannot be undone.'
    );
    
    if (!confirmEnd) return;

    const clearMemory = window.confirm(
      'Do you want to also clear all team data from memory? (Recommended for privacy)'
    );

    setActionLoading(`end-${sessionId}`);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'end',
          confirmEnd: true,
          clearMemory,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchSessions();
        const summary = data.data as SessionSummary;
        alert(`Session ended successfully!\n${summary.teams.length} teams processed.`);
      } else {
        setError(data.error || 'Failed to end session');
      }
    } catch (err) {
      setError('Network error while ending session');
      console.error('Error ending session:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteSession = async (sessionId: string) => {
    const confirmDelete = window.confirm(
      'Are you sure you want to PERMANENTLY DELETE this session? All data will be lost!'
    );
    
    if (!confirmDelete) return;

    setActionLoading(`delete-${sessionId}`);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        await fetchSessions();
        alert('Session deleted successfully!');
      } else {
        setError(data.error || 'Failed to delete session');
      }
    } catch (err) {
      setError('Network error while deleting session');
      console.error('Error deleting session:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: Session['status']) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      ended: 'bg-red-100 text-red-800',
      archived: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="border-b border-gray-200 pb-5 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold leading-6 text-gray-900">
              Session Management
            </h1>
            <p className="mt-2 max-w-4xl text-sm text-gray-500">
              Create, manage, and monitor team assignment sessions. Sessions allow you to organize events 
              and control when team data is stored and cleared.
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            + New Session
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right text-red-700 hover:text-red-900"
            >
              ×
            </button>
          </div>
        )}

        {/* Create Session Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Session</h3>
              
              <form onSubmit={createSession} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Session Name *</label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Hackathon 2024, Team Building Workshop"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Optional description of the session"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Number of Teams *</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      required
                      value={createForm.maxTeams}
                      onChange={(e) => setCreateForm({ ...createForm, maxTeams: parseInt(e.target.value) || 1 })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Teams will be automatically created as "Team 1", "Team 2", etc.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Members per Team</label>
                    <input
                      type="number"
                      min="5"
                      max="20"
                      required
                      value={createForm.maxApplicantsPerTeam}
                      onChange={(e) => setCreateForm({ ...createForm, maxApplicantsPerTeam: parseInt(e.target.value) || 10 })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Custom Session Code</label>
                  <input
                    type="text"
                    value={createForm.sessionCode}
                    onChange={(e) => setCreateForm({ ...createForm, sessionCode: e.target.value.toUpperCase() })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Leave empty for auto-generated (6 characters, A-Z 0-9)"
                    maxLength={6}
                    pattern="[A-Z0-9]{6}"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="allowSelfRegistration"
                      checked={createForm.allowSelfRegistration}
                      onChange={(e) => setCreateForm({ ...createForm, allowSelfRegistration: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="allowSelfRegistration" className="ml-2 block text-sm text-gray-900">
                      Allow participants to create their own teams
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enablePart2"
                      checked={createForm.enablePart2}
                      onChange={(e) => setCreateForm({ ...createForm, enablePart2: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="enablePart2" className="ml-2 block text-sm text-gray-900">
                      Enable Part 2 (custom roles)
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="autoEndAfterAllComplete"
                      checked={createForm.autoEndAfterAllComplete}
                      onChange={(e) => setCreateForm({ ...createForm, autoEndAfterAllComplete: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="autoEndAfterAllComplete" className="ml-2 block text-sm text-gray-900">
                      Auto-end session when all teams are assigned
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'create'}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading === 'create' ? 'Creating...' : 'Create Session'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sessions List */}
        <div className="mt-6">
          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="mt-2 text-sm font-medium text-gray-900">No sessions</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new session.</p>
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  + Create Session
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            {getStatusBadge(session.status)}
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <p className="text-lg font-medium text-gray-900">{session.name}</p>
                              <span className="ml-2 px-2 py-1 text-xs font-mono bg-blue-100 text-blue-800 rounded">
                                {session.settings.sessionCode}
                              </span>
                            </div>
                            {session.description && (
                              <p className="text-sm text-gray-500 mt-1">{session.description}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {session.status === 'active' && (
                            <button
                              onClick={() => endSession(session.id)}
                              disabled={actionLoading === `end-${session.id}`}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 disabled:opacity-50"
                            >
                              {actionLoading === `end-${session.id}` ? 'Ending...' : 'End Session'}
                            </button>
                          )}
                          
                          <button
                            onClick={() => deleteSession(session.id)}
                            disabled={actionLoading === `delete-${session.id}`}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                          >
                            {actionLoading === `delete-${session.id}` ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                      
                      <div className="mt-3 flex items-center text-sm text-gray-500 space-x-6">
                        <span>📅 Created: {new Date(session.createdAt).toLocaleString()}</span>
                        <span>👥 Teams: {session.stats.totalTeams}</span>
                        <span>✅ Complete: {session.stats.completeTeams}</span>
                        <span>👤 Participants: {session.stats.totalApplicants}</span>
                        <span>🎯 Assigned: {session.stats.assignedTeams}</span>
                      </div>
                      
                      {session.endedAt && (
                        <div className="mt-2 text-sm text-gray-500">
                          Ended: {new Date(session.endedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 