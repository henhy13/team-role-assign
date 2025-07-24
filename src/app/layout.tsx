import './globals.css'
import Link from 'next/link'

export const metadata = {
  title: 'Team Role Assignment System',
  description: 'AI-powered optimal team role assignment using Hungarian Algorithm with LLM compatibility scoring',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        {/* Header Navigation */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-8">
                <Link 
                  href="/" 
                  className="text-xl font-bold text-gray-900 hover:text-blue-600"
                >
                  Team Role Assigner
                </Link>
                
                <nav className="flex space-x-4">
                  <Link
                    href="/teams"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Teams
                  </Link>
                  <Link
                    href="/submit"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Join Team
                  </Link>
                  <Link
                    href="/results"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Results
                  </Link>
                </nav>
              </div>

              <div className="flex items-center space-x-4">
                <Link
                  href="/admin"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Admin
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-auto">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center text-sm text-gray-500">
              <div>
                <p>AI-powered team role assignment system</p>
              </div>
              <div className="flex space-x-6">
                <span>🤖 Claude 3.5 Sonnet</span>
                <span>🧮 Hungarian Algorithm</span>
                <span>⚡ High Performance</span>
                <span>📊 Session Management</span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
} 