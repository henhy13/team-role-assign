# Team Role Assignment System

An AI-powered role assignment system that uses machine learning and the Hungarian Algorithm to optimally assign 10 team members to 10 roles based on their skills, experience, and personality traits.

## Features

- **AI-Powered Analysis**: Uses OpenRouter API with advanced language models to analyze team member profiles
- **Optimal Assignment**: Hungarian Algorithm ensures mathematically optimal role assignments
- **Real-time Processing**: Background AI scoring and justification generation
- **Two-Phase System**: Support for Part 1 (standard roles) and Part 2 (custom roles)
- **Comprehensive Analytics**: Detailed scoring, statistics, and AI-generated justifications
- **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS
- **🚀 High-Performance Batch Processing**: Handle hundreds of people across multiple teams using Promise.all
- **🔄 Retry Logic**: Automatic retry with exponential backoff for failed AI requests
- **📊 Bulk Operations**: Batch submission of applicants and parallel team assignment

## How It Works

1. **Team Creation**: Create teams and collect applications from 10 members
2. **AI Scoring**: LLM generates a 10×10 compatibility score matrix
3. **Role Optimization**: Hungarian Algorithm finds optimal 1-to-1 assignments
4. **AI Justification**: Generate personalized explanations for each assignment

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, TypeScript
- **AI Integration**: OpenRouter API (Claude 3.5 Sonnet)
- **Algorithm**: Hungarian Algorithm (munkres-js)
- **Validation**: Zod schema validation
- **Styling**: Tailwind CSS with custom components

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- OpenRouter API key ([get one here](https://openrouter.ai/))

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd team-role-assign
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` and add your OpenRouter API key:
   ```
   OPENROUTER_API_KEY=your_api_key_here
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** to `http://localhost:3000`

## Usage Guide

### Single Team Workflow

#### 1. Create a Team
- Go to the Teams page
- Click "Create New Team"
- Enter a team name

#### 2. Collect Applications
- Navigate to the Submit page
- Have 10 team members fill out their profiles:
  - Name and occupation
  - Skills (technical and soft skills)
  - Personality traits and work style

#### 3. Trigger Assignment
- Once 10 applications are submitted, go to Teams page
- Click "Assign Roles (Part 1)" for the complete team
- The system will:
  - Generate AI compatibility scores
  - Run Hungarian Algorithm optimization
  - Create AI justifications (background process)

#### 4. View Results
- Go to the Results page
- Select your team to view:
  - Role assignments with compatibility scores
  - Assignment statistics and score distribution
  - AI-generated justifications for each assignment

### Batch Processing (High Performance)

For handling hundreds of people across multiple teams:

#### Bulk Application Submission
```bash
POST /api/bulkSubmitApplicants
{
  "applications": [
    {
      "teamId": "team-uuid-1",
      "applicant": {
        "name": "John Doe",
        "occupation": "Software Engineer",
        "skills": ["JavaScript", "React", "Node.js"],
        "personalityTraits": ["collaborative", "analytical", "detail-oriented"]
      }
    },
    // ... up to 500 applications
  ],
  "options": {
    "continueOnError": true,
    "validateTeamLimits": true
  }
}
```

#### Batch Team Assignment
```bash
POST /api/assignTeamsBatch
{
  "teamIds": ["team-1", "team-2", "team-3", ...], // up to 100 teams
  "phase": "part1",
  "options": {
    "maxConcurrency": 10,
    "includeJustifications": true,
    "retryFailedRequests": true
  }
}
```

#### Batch Status Monitoring
```bash
POST /api/batchStatus
{
  "teamIds": ["team-1", "team-2", "team-3"],
  "includeDetails": true,
  "includeStats": true
}
```

### Part 2 Flow
- After Part 1, you can run Part 2 with custom roles
- Useful for different phases of projects or new contexts
- Same optimization process with updated role definitions

## API Endpoints

### Single Team Operations
- `GET /api/teams` - List all teams
- `POST /api/teams` - Create new team
- `GET /api/teams?teamId=<id>` - Get team details
- `POST /api/submitApplicant` - Submit team member application
- `POST /api/assignTeam` - Trigger role assignment (AI + Hungarian Algorithm)
- `GET/POST /api/getAssignments` - Get assignment results and status
- `POST /api/resetTeam` - Reset team (remove all applicants and assignments)

### 🚀 Batch Processing Operations
- `POST /api/bulkSubmitApplicants` - Submit multiple applications (up to 500)
- `POST /api/assignTeamsBatch` - Assign multiple teams simultaneously (up to 100)
- `POST /api/batchStatus` - Check status of multiple assignments

## Performance Optimizations

### Promise.all Implementation
- **Concurrent AI Requests**: Process multiple teams simultaneously
- **Batch Scoring**: Send multiple score requests in parallel with rate limiting
- **Batch Justifications**: Generate explanations for multiple teams concurrently
- **Configurable Concurrency**: Control max simultaneous requests (default: 10)

### Retry Logic
- **Exponential Backoff**: Automatic retry with increasing delays
- **Error Classification**: Distinguish between retryable and permanent errors
- **Rate Limit Handling**: Intelligent handling of API rate limits
- **Graceful Degradation**: Continue processing successful requests when others fail

### Batching Strategies
- **Sequential Batches**: Process teams in batches to respect API limits
- **Random Delays**: Spread retry requests to avoid thundering herd
- **Failure Recovery**: Separate retry processing for failed requests

## Performance Benchmarks

Based on testing with the OpenRouter API:

- **Single Team**: ~3-5 seconds (scoring + assignment + justification)
- **10 Teams Batch**: ~8-12 seconds with 5 concurrent requests
- **50 Teams Batch**: ~25-35 seconds with 10 concurrent requests
- **100 Teams Batch**: ~45-60 seconds with 10 concurrent requests

*Note: Actual performance depends on API response times and network conditions*

## Configuration

### Batch Processing Settings
```typescript
// In batch API calls
{
  maxConcurrency: 10,        // Max simultaneous AI requests
  retryFailedRequests: true, // Enable automatic retries
  includeJustifications: true // Generate AI explanations
}
```

### Role Definitions
Default roles are:
- Role #1 through Role #10

For Part 2, you can define custom roles that better fit your specific context.

### AI Model Configuration
The system uses Claude 3.5 Sonnet by default. You can modify the model in `src/lib/scorer.ts`:

```typescript
private static readonly DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet';
```

### Scoring Parameters
- Scores range from 0-100
- Higher scores indicate better role compatibility
- The Hungarian Algorithm maximizes total team score

## Development

### Project Structure
```
src/
├── app/              # Next.js App Router pages
│   ├── teams/        # Team management
│   ├── submit/       # Application submission
│   ├── results/      # Assignment results
│   └── layout.tsx    # Main layout
├── pages/api/        # API endpoints
│   ├── assignTeamsBatch.ts    # 🚀 Batch team assignment
│   ├── bulkSubmitApplicants.ts # 🚀 Bulk application submission
│   ├── batchStatus.ts         # 🚀 Batch status monitoring
│   ├── submitApplicant.ts
│   ├── assignTeam.ts
│   ├── getAssignments.ts
│   ├── resetTeam.ts
│   └── teams.ts
├── lib/              # Core business logic
│   ├── teamManager.ts
│   ├── scorer.ts     # 🚀 Enhanced with Promise.all
│   ├── assigner.ts
│   ├── justifier.ts  # 🚀 Enhanced with Promise.all
│   └── schema.ts
├── types/            # TypeScript interfaces
└── components/       # Reusable UI components
```

### Key Components

**TeamManager**: Handles team creation, applicant management, and session tracking
**Scorer**: Interfaces with OpenRouter API for AI compatibility scoring (with batch processing)
**Assigner**: Implements Hungarian Algorithm for optimal role assignment
**Justifier**: Generates AI explanations for assignments (with batch processing)

### Data Flow
1. Applications stored in-memory (TeamManager)
2. AI scoring via OpenRouter API (Scorer with Promise.all)
3. Optimization via Hungarian Algorithm (Assigner)
4. Background justification generation (Justifier with Promise.all)

## Production Deployment

### Environment Variables
Set these in your production environment:
- `OPENROUTER_API_KEY`: Your OpenRouter API key
- `NODE_ENV=production`

### Database Integration
The current implementation uses in-memory storage. For production:
1. Replace TeamManager storage with a database (PostgreSQL, MongoDB, etc.)
2. Add proper data persistence
3. Implement user authentication if needed

### Scaling Considerations
- **Background job processing** for AI operations
- **Caching layer** for frequently accessed data
- **Rate limiting** for API endpoints
- **Load balancing** for multiple server instances
- **Database connection pooling**
- **CDN integration** for static assets

### High-Volume Deployment
For processing hundreds of teams:
1. **Horizontal Scaling**: Deploy multiple server instances
2. **Queue System**: Use Redis/Bull for background job processing
3. **Database Optimization**: Implement proper indexing and read replicas
4. **Monitoring**: Add performance tracking and alerting
5. **Error Handling**: Implement circuit breakers and fallback mechanisms

## Troubleshooting

### Common Issues

**OpenRouter API Errors**:
- Verify your API key is correct
- Check your OpenRouter account has sufficient credits
- Ensure network connectivity
- Monitor rate limits for batch processing

**Assignment Failures**:
- Confirm team has exactly 10 members
- Check that all applicant data is valid
- Review server logs for detailed error messages
- Check batch processing limits (100 teams max)

**Performance Issues**:
- Reduce batch size if experiencing timeouts
- Lower maxConcurrency for slower networks
- Enable retryFailedRequests for reliability
- Monitor server resources during batch processing

**UI Issues**:
- Clear browser cache
- Check console for JavaScript errors
- Verify all dependencies are installed

### Batch Processing Troubleshooting

**High Error Rates**:
- Check OpenRouter API status
- Reduce maxConcurrency
- Enable retry logic
- Verify data format consistency

**Slow Performance**:
- Optimize batch sizes (10-50 teams recommended)
- Check network latency
- Monitor API response times
- Consider upgrading OpenRouter plan

### Support
For issues or questions:
1. Check the console logs for detailed error messages
2. Verify your environment configuration
3. Test with a small batch to isolate issues
4. Monitor API usage and limits

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

Built with ❤️ using Next.js, TypeScript, and AI

**🚀 Now with high-performance batch processing for handling hundreds of people!** 