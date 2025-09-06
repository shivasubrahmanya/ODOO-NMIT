# SynergySphere Backend

FastAPI-based backend for the SynergySphere team collaboration platform.

## Features

- **JWT Authentication**: Secure user registration and login
- **RESTful APIs**: Complete CRUD operations for projects, tasks, comments
- **WebSocket Support**: Real-time updates and notifications
- **Email Notifications**: Automatic deadline reminders and task assignments
- **Background Scheduler**: Automated notification system
- **MySQL Integration**: Robust database operations with connection pooling

## Installation

1. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your database and SMTP settings
   ```

4. **Set up database**:
   - Make sure MySQL is running
   - Run the database schema from `../database/schema.sql`
   - Optionally load sample data from `../database/sample_data.sql`

## Configuration

Update `.env` file with your settings:

```env
# Database
DB_HOST=localhost
DB_USER=synergy_user
DB_PASSWORD=synergy_password
DB_NAME=synergysphere

# JWT
SECRET_KEY=your-secret-key-here

# SMTP (for email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

## Running the Server

**Development mode**:
```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Production mode**:
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API Documentation

Once running, visit:
- **Interactive API docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

### Projects
- `GET /api/projects/` - List user projects
- `POST /api/projects/` - Create project
- `GET /api/projects/{id}` - Get project details
- `POST /api/projects/{id}/members` - Add project member
- `GET /api/projects/{id}/progress` - Get project progress

### Tasks
- `GET /api/tasks/project/{project_id}` - Get project tasks
- `POST /api/tasks/project/{project_id}` - Create task
- `PUT /api/tasks/{id}/status` - Update task status

### Comments
- `GET /api/comments/` - Get comments (with project_id or task_id)
- `POST /api/comments/` - Create comment

### Notifications
- `GET /api/notifications/` - Get user notifications
- `POST /api/notifications/mark-read` - Mark notifications as read

### WebSocket
- `ws://localhost:8000/api/ws/project/{project_id}` - Project real-time updates
- `ws://localhost:8000/api/ws/notifications` - Notification updates

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration settings
│   ├── database.py          # Database connection and operations
│   ├── models.py            # Pydantic models
│   ├── auth.py              # Authentication utilities
│   ├── scheduler.py         # Background task scheduler
│   └── routers/             # API route handlers
│       ├── auth.py
│       ├── projects.py
│       ├── tasks.py
│       ├── comments.py
│       ├── notifications.py
│       └── websocket.py
├── requirements.txt         # Python dependencies
├── .env.example            # Environment template
└── README.md
```

## Background Services

The application includes:

1. **Deadline Reminders**: Checks hourly for upcoming task deadlines
2. **Email Notifications**: Sends email alerts for task assignments and reminders
3. **WebSocket Manager**: Handles real-time connections and broadcasts

## Development

**Running tests** (if implemented):
```bash
pytest
```

**Code formatting**:
```bash
black app/
```

**Linting**:
```bash
flake8 app/
```
