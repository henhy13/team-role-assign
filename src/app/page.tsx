import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
            AI-Powered Team
            <span className="text-blue-600"> Role Assignment</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Optimal team role assignment using Large Language Models for compatibility scoring 
            and the Hungarian Algorithm for perfect 1-to-1 matching.
          </p>
        </div>

        {/* Features */}
        <div className="mt-16">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-blue-600 text-2xl mb-4">🧠</div>
              <h3 className="text-lg font-medium text-gray-900">AI-Powered Scoring</h3>
              <p className="mt-2 text-sm text-gray-500">
                Claude 3.5 Sonnet analyzes applicant profiles and generates compatibility scores for each role.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-blue-600 text-2xl mb-4">🎯</div>
              <h3 className="text-lg font-medium text-gray-900">Optimal Assignment</h3>
              <p className="mt-2 text-sm text-gray-500">
                Hungarian Algorithm ensures maximum overall team compatibility with perfect 1-to-1 matching.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-blue-600 text-2xl mb-4">⚡</div>
              <h3 className="text-lg font-medium text-gray-900">High Performance</h3>
              <p className="mt-2 text-sm text-gray-500">
                Promise.all batch processing handles hundreds of participants with concurrent AI requests.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-blue-600 text-2xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900">Session Management</h3>
              <p className="mt-2 text-sm text-gray-500">
                Organized sessions with memory control for events, workshops, and competitions.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-blue-600 text-2xl mb-4">🔄</div>
              <h3 className="text-lg font-medium text-gray-900">Part 2 Flow</h3>
              <p className="mt-2 text-sm text-gray-500">
                Secondary round with custom roles for different contexts or event phases.
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-blue-600 text-2xl mb-4">💡</div>
              <h3 className="text-lg font-medium text-gray-900">AI Justifications</h3>
              <p className="mt-2 text-sm text-gray-500">
                Background-generated explanations for each assignment decision using natural language.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center">How It Works</h2>
          <div className="mt-8 space-y-8">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                1
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Admin Creates Session</h3>
                <p className="text-gray-500">Admin creates a new session with settings, team limits, and a join code for participants.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                2
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Participants Join Teams</h3>
                <p className="text-gray-500">Using the session code, participants create teams and submit their profiles with skills and personality traits.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                3
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">AI Compatibility Scoring</h3>
                <p className="text-gray-500">When teams are complete (10 members), AI generates a 10×10 compatibility score matrix for all applicant-role combinations.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                4
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Optimal Assignment</h3>
                <p className="text-gray-500">Hungarian Algorithm finds the perfect 1-to-1 assignment that maximizes overall team compatibility.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                5
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Results & Justifications</h3>
                <p className="text-gray-500">Instant assignment results with compatibility scores, plus AI-generated explanations delivered shortly after.</p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                6
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Session Management</h3>
                <p className="text-gray-500">Admin can end sessions and optionally clear memory for privacy, or keep data for analysis.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Getting Started */}
        <div className="mt-16 bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-8">
            <h2 className="text-2xl font-bold text-gray-900 text-center">Get Started</h2>
            <p className="mt-2 text-center text-gray-600">Choose your role to begin</p>
            
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Admin Flow */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 flex items-center">
                  <span className="text-blue-600 text-lg mr-2">👨‍💼</span>
                  Event Organizer/Admin
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Create and manage sessions, control team formation, and monitor progress.
                </p>
                <Link
                  href="/admin"
                  className="mt-3 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Access Admin Dashboard
                </Link>
              </div>

              {/* Participant Flow */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 flex items-center">
                  <span className="text-green-600 text-lg mr-2">👥</span>
                  Participant
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Join a session, create/join teams, and get assigned your optimal role.
                </p>
                <div className="mt-3 space-y-2">
                  <Link
                    href="/teams"
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Browse Teams
                  </Link>
                  <Link
                    href="/submit"
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    Join a Team
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Powered By</h2>
          <div className="mt-6 flex justify-center items-center space-x-8 text-gray-400">
            <div className="text-center">
              <div className="text-2xl">🤖</div>
              <p className="text-xs mt-1">Claude 3.5 Sonnet</p>
            </div>
            <div className="text-center">
              <div className="text-2xl">🧮</div>
              <p className="text-xs mt-1">Hungarian Algorithm</p>
            </div>
            <div className="text-center">
              <div className="text-2xl">⚛️</div>
              <p className="text-xs mt-1">Next.js + TypeScript</p>
            </div>
            <div className="text-center">
              <div className="text-2xl">🎨</div>
              <p className="text-xs mt-1">Tailwind CSS</p>
            </div>
            <div className="text-center">
              <div className="text-2xl">🔗</div>
              <p className="text-xs mt-1">OpenRouter API</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 