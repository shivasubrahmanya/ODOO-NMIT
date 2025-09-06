# Project Management System

A comprehensive project management system that enables teams to collaborate effectively through project creation, task management, and threaded discussions. Built with modern technologies and designed for scalability and responsiveness.

## 🌟 Features

### Core Functionality
- **Project Management**: Create, manage, and track multiple projects with team collaboration
- **Task Management**: Assign tasks with deadlines, priorities, and status tracking (To-Do, In Progress, Done)
- **Team Collaboration**: Add team members with role-based permissions (Owner, Admin, Member)
- **Threaded Discussions**: Project-specific discussion threads with reply functionality
- **Real-time Updates**: Live notifications and updates via WebSocket connections
- **Deadline Monitoring**: Automatic alerts for approaching and overdue tasks
- **User Management**: Complete authentication system with JWT tokens

### Advanced Features
- **Efficient Data Structures**: Optimized database queries with proper indexing
- **Caching System**: Redis-based caching for improved performance
- **Role-based Access Control**: Granular permissions system
- **Real-time Notifications**: Instant updates on task changes and new messages
- **Search & Filtering**: Advanced search capabilities across projects and tasks
- **Activity Tracking**: Comprehensive activity logs for all project actions
- **Responsive Design**: Mobile-friendly user interface
- **Scalable Architecture**: Microservices-ready design

## 🏗️ System Architecture

### Backend Stack
- **Framework**: Node.js with Express.js
- **Database**: PostgreSQL with connection pooling
- **Caching**: Redis for session management and real-time features
- **Authentication**: JWT tokens with refresh token rotation
- **Real-time**: Socket.IO for WebSocket connections
- **Validation**: Joi for input validation
- **Security**: Helmet, CORS, rate limiting, bcrypt for password hashing

### Database Design
- **Users**: Authentication and profile information
- **Projects**: Project metadata and settings
- **Project Members**: Many-to-many relationship with roles
- **Tasks**: Task management with assignments and deadlines
- **Discussions**: Threaded discussion system
- **Notifications**: User notification system
- **Efficient Indexing**: Optimized queries with strategic indexes

### Key Data Structures
- **Hash Maps**: Quick user and project lookups
- **Priority Queues**: Deadline-based task sorting
- **Trees**: Threaded discussion message hierarchy
- **Sets**: Project member permissions management

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Redis server
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/project-management-system.git
   cd project-management-system
   ```

2. **Install dependencies**
   ```bash
   npm run setup
   ```

3. **Set up environment variables**
   ```bash
   cp server/.env.example server/.env
   ```
   Edit `server/.env` with your configuration:
   ```env
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=projectmanagement
   DB_USER=postgres
   DB_PASSWORD=your_password
   
   # Redis
   REDIS_HOST=localhost
   REDIS_PORT=6379
   
   # JWT Secrets (generate secure secrets)
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-super-secret-refresh-key
   ```

4. **Set up the database**
   ```bash
   # Create PostgreSQL database
   createdb projectmanagement
   
   # Run migrations (tables will be created automatically on first run)
   npm run server:start
   ```

5. **Start the development servers**
   ```bash
   npm run dev
   ```
   
   This will start:
   - Backend server on `http://localhost:5000`
   - Frontend development server on `http://localhost:3000`

## 📁 Project Structure

```
project-management-system/
├── server/                          # Backend API
│   ├── app.js                      # Main server entry point
│   ├── config/                     # Configuration files
│   │   ├── database.js             # PostgreSQL connection & schema
│   │   └── redis.js                # Redis connection & cache utilities
│   ├── middleware/                 # Express middleware
│   │   ├── auth.js                 # Authentication & authorization
│   │   └── errorHandler.js         # Centralized error handling
│   ├── routes/                     # API route handlers
│   │   ├── auth.js                 # Authentication endpoints
│   │   ├── projects.js             # Project CRUD operations
│   │   ├── tasks.js                # Task management
│   │   ├── discussions.js          # Discussion threads
│   │   ├── users.js                # User management
│   │   └── notifications.js        # Notification system
│   ├── services/                   # Business logic services
│   │   └── deadlineService.js      # Deadline monitoring
│   ├── socket/                     # WebSocket handlers
│   │   └── socketHandler.js        # Real-time event handling
│   └── package.json                # Backend dependencies
├── client/                         # Frontend React application
│   └── [React app structure]       # To be created
├── ARCHITECTURE.md                 # Detailed system architecture
├── package.json                    # Root package configuration
└── README.md                      # This file
```

## 🔧 Configuration

### Environment Variables

#### Server Configuration
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 5000)
- `CLIENT_URL`: Frontend URL for CORS

#### Database Configuration
- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port
- `DB_NAME`: Database name
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password

#### Redis Configuration
- `REDIS_HOST`: Redis server host
- `REDIS_PORT`: Redis server port
- `REDIS_PASSWORD`: Redis password (if required)

#### Security Configuration
- `JWT_SECRET`: JWT signing secret
- `JWT_REFRESH_SECRET`: Refresh token secret
- `BCRYPT_ROUNDS`: Password hashing rounds (default: 12)

## 📊 API Documentation

### Authentication Endpoints

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "tokens": {
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token"
  }
}
```

#### POST /api/auth/login
Authenticate user and receive tokens.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

### Project Endpoints

#### GET /api/projects
Get all projects for the authenticated user.

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `status`: Filter by status (active/completed/archived)
- `search`: Search in project names and descriptions

#### POST /api/projects
Create a new project.

**Request Body:**
```json
{
  "name": "My New Project",
  "description": "Project description",
  "deadline": "2024-12-31T23:59:59Z"
}
```

#### GET /api/projects/:projectId
Get detailed project information including tasks and team members.

### Task Endpoints

#### GET /api/tasks
Get tasks with filtering options.

**Query Parameters:**
- `projectId`: Filter by project
- `status`: Filter by status (todo/in-progress/done)
- `assignedTo`: Filter by assignee
- `priority`: Filter by priority (low/medium/high/critical)

#### POST /api/tasks
Create a new task.

**Request Body:**
```json
{
  "title": "Task Title",
  "description": "Task description",
  "projectId": "project-uuid",
  "assignedTo": "user-uuid",
  "priority": "high",
  "deadline": "2024-01-31T23:59:59Z"
}
```

### Real-time Events

#### WebSocket Events
- `task-updated`: Task status or details changed
- `new-task`: New task created
- `discussion-message`: New message in project discussion
- `user-online`/`user-offline`: User presence updates
- `deadline-alert`: Task deadline notifications

## 🔒 Security Features

### Authentication & Authorization
- **JWT Tokens**: Secure authentication with access and refresh tokens
- **Password Hashing**: bcrypt with configurable salt rounds
- **Role-based Access Control**: Project-level and system-level permissions
- **Token Blacklisting**: Secure logout with token invalidation

### API Security
- **Rate Limiting**: Prevents API abuse with configurable limits
- **Input Validation**: Comprehensive validation using Joi
- **SQL Injection Prevention**: Parameterized queries via PostgreSQL driver
- **XSS Protection**: Security headers via Helmet middleware
- **CORS Configuration**: Controlled cross-origin resource sharing

## 📈 Performance Features

### Caching Strategy
- **Redis Cache**: User sessions, project data, and activity logs
- **Database Connection Pooling**: Optimized database connections
- **Query Optimization**: Strategic database indexes for fast queries

### Real-time Performance
- **WebSocket Connections**: Efficient real-time updates
- **Event-driven Architecture**: Scalable real-time event handling
- **Connection Management**: Automatic reconnection and heartbeat monitoring

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run server tests only
npm run test:server

# Run client tests only
npm run test:client

# Run tests with coverage
npm run test:coverage
```

### Test Structure
- **Unit Tests**: Individual component and function testing
- **Integration Tests**: API endpoint testing
- **Real-time Tests**: WebSocket event testing

## 🚀 Deployment

### Production Setup

1. **Environment Configuration**
   ```bash
   NODE_ENV=production
   JWT_SECRET=production-jwt-secret
   DB_PASSWORD=secure-production-password
   ```

2. **Database Migration**
   ```bash
   npm run migrate
   ```

3. **Build and Start**
   ```bash
   npm run build
   npm start
   ```

### Docker Deployment
```bash
# Build Docker image
npm run docker:build

# Run with Docker
npm run docker:run
```

### Recommended Production Stack
- **Process Manager**: PM2 for Node.js process management
- **Reverse Proxy**: Nginx for load balancing and SSL termination
- **Database**: PostgreSQL with replication for high availability
- **Caching**: Redis cluster for distributed caching
- **Monitoring**: Application and database monitoring tools

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- **ESLint**: JavaScript/Node.js linting
- **Prettier**: Code formatting
- **Conventional Commits**: Commit message format

### Development Guidelines
- Follow RESTful API design principles
- Write comprehensive tests for new features
- Document API endpoints and major functions
- Use TypeScript for type safety (recommended)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Common Issues

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Create database if it doesn't exist
createdb projectmanagement
```

#### Redis Connection Issues
```bash
# Start Redis server
redis-server

# Check Redis connectivity
redis-cli ping
```

#### Port Conflicts
- Backend runs on port 5000 by default
- Frontend runs on port 3000 by default
- Change ports in `.env` file if needed

### Getting Help
- **Documentation**: Check `/docs` folder for detailed guides
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions

## 🎯 Roadmap

### Upcoming Features
- [ ] Mobile applications (React Native)
- [ ] Advanced reporting and analytics
- [ ] File attachment system
- [ ] Email notifications
- [ ] Integration APIs (Slack, Microsoft Teams)
- [ ] Gantt charts and timeline views
- [ ] Advanced search with Elasticsearch
- [ ] Automated testing pipeline
- [ ] Multi-language support

### Performance Improvements
- [ ] GraphQL API option
- [ ] Database query optimization
- [ ] CDN integration for static assets
- [ ] Progressive Web App (PWA) features

---
## 🏆 Team Details 
 ---------------------------------------------
| Member Name                 | Passing Year |
|-----------------------------|--------------|
| Mance Uthappa		      |  2027        |
| Amulya U Shet        	      |  2027        |
| Shivasubrahmanya K C        |  2027        |
| G Nisha Bangera     	      |  2027        |
----------------------------------------------
- **Selected Problem Statement:** "SynergySphere – Advanced Team Collaboration Platform"
- **Video Link:**
---
## 🙏 Acknowledgments

- Built with love using modern web technologies
- Inspired by popular project management tools
- Community contributions welcome
---
**Happy Project Managing! 🚀**
