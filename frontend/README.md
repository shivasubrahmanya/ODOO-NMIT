# SynergySphere Frontend

React TypeScript frontend for the SynergySphere team collaboration platform.

## Features

- **Modern React 19** with TypeScript
- **React Router** for client-side routing  
- **Context API** for state management (no Redux needed)
- **Responsive Design** with CSS Grid and Flexbox
- **JWT Authentication** with persistent login
- **Real-time Updates** via WebSocket (structure ready)
- **Progressive Web App** ready

## Tech Stack

- React 19 with TypeScript
- React Router DOM for navigation
- Context API for global state
- CSS3 with modern features
- WebSocket API for real-time features
- No external UI libraries (pure CSS)

## Installation & Setup

1. **Prerequisites**
   - Node.js 18+ and npm
   - Backend server running on http://localhost:8000

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create `.env` file in the frontend root:
   ```env
   REACT_APP_API_URL=http://localhost:8000/api
   ```

4. **Start Development Server**
   ```bash
   npm start
   ```

5. **Access Application**
   - Open http://localhost:3000 in your browser

## Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests  
- `npm run eject` - Eject from Create React App (not recommended)

## Features Implemented

### ✅ Authentication System
- User registration and login
- JWT token management
- Persistent authentication state
- Protected routes
- Automatic logout handling

### ✅ Project Management
- Project creation and listing
- Team member management (structure ready)
- Role-based access control (backend ready)
- Project progress tracking (API ready)

### ✅ Responsive Design
- Mobile-first responsive design
- Modern, clean interface
- Loading states and error handling
- CSS animations and transitions

### 🚧 Coming Soon
- Task management interface
- Real-time WebSocket integration
- Comment system
- Notification panel
- Advanced project features

## Project Structure

```
src/
├── components/        # Reusable UI components (to be expanded)
├── contexts/          # React Context providers
│   └── AuthContext.tsx
├── pages/            # Page components
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   └── ProjectPage.tsx (placeholder)
├── services/         # API service layer
│   └── api.ts
├── types/            # TypeScript definitions
│   └── index.ts
├── utils/            # Utility functions (to be expanded)
├── App.tsx           # Main app component
└── index.tsx         # Application entry point
```

## API Integration

The frontend communicates with the FastAPI backend through:
- RESTful API calls for CRUD operations
- JWT authentication for all protected endpoints
- WebSocket connections for real-time features (ready)
- Comprehensive error handling

## Build & Deployment

### Production Build
```bash
npm run build
```

### Deployment
The built application can be deployed to:
- Static hosting (Netlify, Vercel)
- Traditional web servers (Apache, Nginx)
- Cloud platforms (AWS S3, Azure)

## Learn More

- [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started)
- [React documentation](https://reactjs.org/)
- [TypeScript documentation](https://www.typescriptlang.org/)
