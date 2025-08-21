# AI Health Assistant

A monorepo application featuring an AI-powered health and wellness assistant that conducts lifestyle assessments through conversational interactions.

## Features

- **Conversational AI Assistant**: Powered by Google's Gemini Flash model via Vertex AI
- **Lifestyle Assessment**: Asks users about sleep, stress, diet, and exercise habits
- **Real-time Streaming**: Server-Sent Events (SSE) for streaming AI responses
- **Session Management**: Create, resume, and manage multiple chat sessions
- **In-Memory Storage**: Sessions stored in memory (scalable to multiple instances)
- **Modern UI**: Built with Next.js 15, shadcn/ui, and Tailwind CSS

## Tech Stack

- **Backend**: NestJS 11 with TypeScript
- **Frontend**: Next.js 15 with TypeScript
- **AI**: Google Vertex AI (Gemini 1.5 Flash)
- **UI Components**: shadcn/ui with Radix UI
- **Styling**: Tailwind CSS 3
- **Package Manager**: pnpm
- **Node Version**: 22+

## Prerequisites

- Node.js 22 or higher
- pnpm 10+ (`npm install -g pnpm`)
- Google Cloud Project with Vertex AI API enabled
- Google Cloud credentials configured

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Clone the repository
cd ai-assistant

# Install all dependencies
pnpm install
```

### 2. Configure Google Cloud Credentials

#### Option A: Using Service Account (Recommended for Production)

1. Create a service account in your Google Cloud Project
2. Download the service account key JSON file
3. Set the environment variable:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

#### Option B: Using gcloud CLI (Development)

```bash
# Install gcloud CLI if not already installed
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth application-default login

# Set your project
gcloud config set project YOUR_PROJECT_ID
```

### 3. Configure Environment Variables

#### Backend Configuration

Create `.env` file in `apps/backend/`:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Edit `apps/backend/.env`:

```env
# Google Cloud Project Configuration
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# Server Port
PORT=3001
```

#### Frontend Configuration

The frontend environment is already configured in `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 4. Enable Vertex AI API

```bash
# Enable the Vertex AI API in your project
gcloud services enable aiplatform.googleapis.com
```

## Running the Application

### Development Mode

Run both frontend and backend in parallel:

```bash
# From the root directory
pnpm dev
```

Or run them separately:

```bash
# Terminal 1 - Backend (port 3001)
cd apps/backend
pnpm dev

# Terminal 2 - Frontend (port 3000)
cd apps/frontend
pnpm dev
```

### Production Build

```bash
# Build all applications
pnpm build

# Run backend in production
cd apps/backend
pnpm start:prod

# Run frontend in production
cd apps/frontend
pnpm start
```

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Click "New Session" to start a conversation
3. The AI assistant will greet you and ask lifestyle questions
4. Answer the questions naturally - the AI will guide you through 5 questions
5. Sessions are saved in memory and can be resumed
6. After answering 5 questions, the session is marked as complete

## API Endpoints

### Backend API (http://localhost:3001/api)

- `POST /chat/sessions` - Create a new session
- `GET /chat/sessions` - Get all sessions
- `GET /chat/sessions/:id` - Get specific session
- `DELETE /chat/sessions/:id` - Delete a session
- `POST /chat/sessions/:id/messages` - Send a message
- `GET /chat/sessions/:id/stream` - SSE stream for AI responses
- `POST /chat/sessions/:id/start` - Start conversation

## Architecture

### Session Management

- Sessions are stored in-memory using a Map data structure
- Each session tracks messages, questions answered, and completion status
- Sessions persist until the backend is restarted

### Scalability

- The application can be scaled horizontally
- For multi-instance deployment, consider adding:
  - Redis for shared session storage
  - Sticky sessions or session affinity in load balancer

### AI Integration

- Uses Google's Gemini 1.5 Flash model
- Streaming responses via Server-Sent Events
- Context-aware conversation flow
- Tracks progress through 5 lifestyle questions

## Project Structure

```
ai-assistant/
├── apps/
│   ├── backend/          # NestJS backend
│   │   ├── src/
│   │   │   ├── ai/       # Vertex AI integration
│   │   │   ├── chat/     # Chat controller & module
│   │   │   ├── session/  # Session management
│   │   │   └── common/   # Shared interfaces
│   │   └── ...
│   └── frontend/         # Next.js frontend
│       ├── app/          # App router pages
│       ├── components/   # React components
│       │   └── ui/       # shadcn components
│       ├── lib/          # Utilities & API client
│       └── ...
├── packages/             # Shared packages (future use)
├── pnpm-workspace.yaml   # Monorepo configuration
└── package.json          # Root package.json
```

## Troubleshooting

### Common Issues

1. **Vertex AI Authentication Error**

   - Ensure Google Cloud credentials are properly configured
   - Verify the project ID and location in `.env`
   - Check if Vertex AI API is enabled

2. **CORS Issues**

   - Ensure the backend FRONTEND_URL matches your frontend URL
   - Check that both applications are running on the correct ports

3. **SSE Connection Failed**
   - Verify the backend is running on port 3001
   - Check browser console for specific error messages
   - Ensure no proxy/firewall is blocking SSE connections

## Future Enhancements

- Add Redis for distributed session storage
- Implement user authentication
- Add conversation history export
- Enhance AI prompts for better conversation flow
- Add more detailed health insights based on responses
- Implement WebSocket support as alternative to SSE

## License

MIT
