'use client';

import { useState, useEffect } from 'react';
import { Team } from '../../types';

export default function SubmitPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  
  const [formData, setFormData] = useState({
    name: '',
    occupation: '',
    skills: [''],
    personalityTraits: ['']
  });

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
        // Auto-select the first incomplete team
        const incompleteTeam = data.data.find((team: Team) => !team.isComplete);
        if (incompleteTeam) {
          setSelectedTeamId(incompleteTeam.id);
        }
      } else {
        setMessage(`Error loading teams: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to load teams');
      console.error('Load teams error:', error);
    }
  };

  const handleSkillChange = (index: number, value: string) => {
    const newSkills = [...formData.skills];
    newSkills[index] = value;
    setFormData({ ...formData, skills: newSkills });
  };

  const addSkill = () => {
    if (formData.skills.length < 20) {
      setFormData({ ...formData, skills: [...formData.skills, ''] });
    }
  };

  const removeSkill = (index: number) => {
    if (formData.skills.length > 1) {
      const newSkills = formData.skills.filter((_, i) => i !== index);
      setFormData({ ...formData, skills: newSkills });
    }
  };

  const handleTraitChange = (index: number, value: string) => {
    const newTraits = [...formData.personalityTraits];
    newTraits[index] = value;
    setFormData({ ...formData, personalityTraits: newTraits });
  };

  const addTrait = () => {
    if (formData.personalityTraits.length < 20) {
      setFormData({ ...formData, personalityTraits: [...formData.personalityTraits, ''] });
    }
  };

  const removeTrait = (index: number) => {
    if (formData.personalityTraits.length > 1) {
      const newTraits = formData.personalityTraits.filter((_, i) => i !== index);
      setFormData({ ...formData, personalityTraits: newTraits });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTeamId) {
      setMessage('Please select a team');
      return;
    }

    // Filter out empty skills and traits
    const cleanedSkills = formData.skills.filter(skill => skill.trim());
    const cleanedTraits = formData.personalityTraits.filter(trait => trait.trim());

    if (cleanedSkills.length === 0) {
      setMessage('Please add at least one skill');
      return;
    }

    if (cleanedTraits.length === 0) {
      setMessage('Please add at least one personality trait');
      return;
    }

    setLoading(true);
    setMessage('Submitting application...');

    try {
      const response = await fetch('/api/submitApplicant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeamId,
          applicant: {
            name: formData.name.trim(),
            occupation: formData.occupation.trim(),
            skills: cleanedSkills,
            personalityTraits: cleanedTraits
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage(data.message);
        
        // Reset form
        setFormData({
          name: '',
          occupation: '',
          skills: [''],
          personalityTraits: ['']
        });

        // Reload teams to update counts
        setTimeout(() => {
          loadTeams();
        }, 1000);
        
        // If team is complete, suggest going to assignment
        if (data.data.teamComplete) {
          setTimeout(() => {
            setMessage(data.message + ' Go to Teams page to assign roles!');
          }, 2000);
        }
      } else {
        setMessage(`Submission failed: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to submit application');
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedTeam = teams.find(team => team.id === selectedTeamId);

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">Submit Application</h1>
            <p className="mt-2 text-sm text-gray-700">
              Submit your information to join a team. Teams need exactly 10 members before role assignment.
            </p>
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
            <div className="space-y-4">
              <div>
                <label className="form-label">Choose Team</label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="">Select a team...</option>
                  {teams.map((team) => (
                    <option 
                      key={team.id} 
                      value={team.id}
                      disabled={team.isComplete}
                    >
                      {team.name} ({team.applicants.length}/10) {team.isComplete ? '- FULL' : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              {selectedTeam && (
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                  <p><strong>Team:</strong> {selectedTeam.name}</p>
                  <p><strong>Current Members:</strong> {selectedTeam.applicants.length}/10</p>
                  <p><strong>Status:</strong> {selectedTeam.isComplete ? 'Full - No more members needed' : `Need ${10 - selectedTeam.applicants.length} more member(s)`}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Application Form */}
        {selectedTeamId && !selectedTeam?.isComplete && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* Basic Information */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium">Personal Information</h3>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                
                <div>
                  <label className="form-label">Current Occupation *</label>
                  <input
                    type="text"
                    value={formData.occupation}
                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    className="form-input"
                    placeholder="e.g., Software Engineer, Marketing Manager, Student"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Skills */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium">Skills</h3>
                <p className="text-sm text-gray-600">List your relevant skills and competencies</p>
              </div>
              <div className="card-body space-y-3">
                {formData.skills.map((skill, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={skill}
                      onChange={(e) => handleSkillChange(index, e.target.value)}
                      className="form-input flex-1"
                      placeholder={`Skill ${index + 1}`}
                    />
                    {formData.skills.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSkill(index)}
                        className="btn-danger px-3"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                
                {formData.skills.length < 20 && (
                  <button
                    type="button"
                    onClick={addSkill}
                    className="btn-secondary"
                  >
                    Add Another Skill
                  </button>
                )}
              </div>
            </div>

            {/* Personality Traits */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium">Personality Traits</h3>
                <p className="text-sm text-gray-600">Describe your personality characteristics and work style</p>
              </div>
              <div className="card-body space-y-3">
                {formData.personalityTraits.map((trait, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={trait}
                      onChange={(e) => handleTraitChange(index, e.target.value)}
                      className="form-input flex-1"
                      placeholder={`Trait ${index + 1} (e.g., collaborative, analytical, creative)`}
                    />
                    {formData.personalityTraits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTrait(index)}
                        className="btn-danger px-3"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                
                {formData.personalityTraits.length < 20 && (
                  <button
                    type="button"
                    onClick={addTrait}
                    className="btn-secondary"
                  >
                    Add Another Trait
                  </button>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        )}

        {selectedTeam?.isComplete && (
          <div className="mt-6 card">
            <div className="card-body text-center">
              <p className="text-gray-600">This team is full! Please select a different team or create a new one.</p>
            </div>
          </div>
        )}

        {teams.length === 0 && (
          <div className="mt-6 card">
            <div className="card-body text-center">
              <p className="text-gray-600">No teams available. Please create a team first in the Teams page.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 