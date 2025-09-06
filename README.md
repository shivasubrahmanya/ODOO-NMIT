# SynergySphere - Team Collaboration MVP

A comprehensive full-stack team collaboration application built with React frontend, Python FastAPI backend, and MySQL database. This MVP demonstrates modern web development practices with real-time features, responsive design, and robust backend architecture.

## 🚀 Features

### Core Functionality
- **🔐 Authentication**: Secure JWT-based registration, login, and logout
- **📊 Project Management**: Create projects, manage team members with role-based access
- **✅ Task Management**: Create, assign, and track tasks with status updates
- **💬 Real-time Communication**: Threaded comments and discussions
- **🔔 Smart Notifications**: In-app and email notifications with deadline reminders
- **📱 Responsive Design**: Fully responsive for desktop, tablet, and mobile

### Technical Features
- **⚡ Real-time Updates**: WebSocket integration for live collaboration
- **📧 Email System**: Automated deadline reminders and task notifications
- **🎨 Modern UI/UX**: Clean, intuitive interface with CSS animations
- **🔒 Secure Backend**: JWT authentication with password hashing
- **📈 Progress Tracking**: Visual progress indicators and completion statistics

## 🛠 Tech Stack

### Frontend
- **React 19** with TypeScript
- **React Router** for navigation
- **Context API** for state management
- **CSS3** with Flexbox/Grid (no external UI libraries)
- **WebSocket API** for real-time features

### Backend
- **FastAPI** with Python 3.8+
- **JWT Authentication** with bcrypt password hashing
- **MySQL** database with connection pooling
- **WebSocket** support for real-time updates
- **APScheduler** for background tasks
- **SMTP** integration for email notifications

### Database
- **MySQL 8.0+** with foreign key constraints
- **Normalized schema** with proper indexing
- **Sample data** for testing and development

## 📁 Project Structure

```
SynergySphere/
├── 📁 frontend/              # React TypeScript application
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   ├── contexts/        # React Context providers
│   │   ├── pages/           # Page components
│   │   ├── services/        # API service layer
│   │   ├── types/           # TypeScript type definitions
│   │   └── utils/           # Utility functions
│   ├── public/              # Static assets
│   └── package.json         # Dependencies and scripts
├── 📁 backend/               # FastAPI Python server
│   ├── app/
│   │   ├── routers/         # API route handlers
│   │   ├── auth.py          # Authentication utilities
│   │   ├── database.py      # Database operations
│   │   ├── models.py        # Pydantic models
│   │   ├── scheduler.py     # Background task scheduler
│   │   └── main.py          # Application entry point
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment configuration
├── 📁 database/              # MySQL schema and data
│   ├── schema.sql           # Database structure
│   ├── sample_data.sql      # Test data
│   └── README.md            # Database setup guide
└── 📁 docs/                  # Additional documentation
```

## ⚡ Quick Start

### Prerequisites
- **Node.js 18+** and npm
- **Python 3.8+** and pip
- **MySQL 8.0+** server
- Modern web browser

### 1. Database Setup

```bash
# Start MySQL service
sudo service mysql start  # Linux
# or
brew services start mysql  # macOS
# or start MySQL from Windows Services

# Create database and user
mysql -u root -p
```

```sql
CREATE DATABASE synergysphere;
CREATE USER 'synergy_user'@'localhost' IDENTIFIED BY 'synergy_password';
GRANT ALL PRIVILEGES ON synergysphere.* TO 'synergy_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

```bash
# Import schema and sample data
cd database/
mysql -u synergy_user -p synergysphere < schema.sql
mysql -u synergy_user -p synergysphere < sample_data.sql
```

### 2. Backend Setup

```bash
cd backend/

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start the server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend Setup

```bash
cd frontend/

# Install dependencies
npm install

# Start development server
npm start
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 🔧 Configuration

### Backend Environment Variables (.env)

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=synergy_user
DB_PASSWORD=synergy_password
DB_NAME=synergysphere

# JWT
SECRET_KEY=your-super-secret-jwt-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# SMTP (for email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@synergysphere.com

# CORS
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Frontend Environment Variables (.env)

```env
REACT_APP_API_URL=http://localhost:8000/api
```

## 📚 API Documentation

Once the backend is running, visit http://localhost:8000/docs for interactive API documentation.

### Key Endpoints

- **Authentication**
  - `POST /api/auth/register` - Register new user
  - `POST /api/auth/login` - User login
  - `GET /api/auth/me` - Get current user

- **Projects**
  - `GET /api/projects/` - List user projects
  - `POST /api/projects/` - Create project
  - `GET /api/projects/{id}` - Get project details
  - `POST /api/projects/{id}/members` - Add team member

- **Tasks**
  - `GET /api/tasks/project/{project_id}` - Get project tasks
  - `POST /api/tasks/project/{project_id}` - Create task
  - `PUT /api/tasks/{id}/status` - Update task status

- **Real-time**
  - `ws://localhost:8000/api/ws/project/{id}` - Project WebSocket
  - `ws://localhost:8000/api/ws/notifications` - Notifications WebSocket

## 🧪 Testing

### Sample User Accounts (from sample_data.sql)

- **Admin User**
  - Email: `john@example.com`
  - Password: `password123` (you'll need to hash this)

- **Regular User**
  - Email: `jane@example.com`
  - Password: `password123` (you'll need to hash this)

### Creating Test Users

Use the registration form or register via API:

```bash
curl -X POST "http://localhost:8000/api/auth/register" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test User",
       "email": "test@example.com",
       "password": "password123"
     }'
```

## 🚀 Production Deployment

### Backend Deployment

1. **Environment Setup**
   ```bash
   # Use production database
   # Set strong JWT secret
   # Configure production SMTP
   ```

2. **Run with Gunicorn**
   ```bash
   pip install gunicorn
   gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
   ```

### Frontend Deployment

1. **Build for Production**
   ```bash
   npm run build
   ```

2. **Serve Static Files**
   - Deploy `build/` folder to your web server
   - Configure routing for SPA

## 🛡 Security Features

- **JWT Authentication** with secure token handling
- **Password Hashing** using bcrypt
- **CORS Protection** with configurable origins
- **SQL Injection Protection** via parameterized queries
- **Input Validation** with Pydantic models

## 🎨 UI/UX Features

- **Responsive Design** - Works on all device sizes
- **Modern Interface** - Clean, professional design
- **Loading States** - Proper feedback during operations
- **Error Handling** - User-friendly error messages
- **Accessibility** - ARIA labels and keyboard navigation

## 🔄 Real-time Features

- **Live Task Updates** - See changes instantly
- **Real-time Comments** - Instant messaging experience
- **Push Notifications** - Stay informed of updates
- **Collaborative Editing** - Multiple users can work simultaneously

## 📧 Email Notifications

- **Task Assignments** - Notify when tasks are assigned
- **Deadline Reminders** - Automated reminders for due tasks
- **Project Invitations** - Email invites for team members
- **Status Updates** - Progress notifications

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Ensure MySQL is running
   - Check database credentials in `.env`
   - Verify database exists

2. **CORS Errors**
   - Check `CORS_ORIGINS` in backend `.env`
   - Ensure frontend URL is included

3. **Email Not Sending**
   - Configure SMTP settings properly
   - For Gmail, use App Passwords

4. **WebSocket Connection Failed**
   - Check firewall settings
   - Ensure backend is running

## 🤝 Contributing

This is a demonstration MVP. For production use, consider:

- Adding comprehensive tests
- Implementing proper logging
- Adding rate limiting
- Setting up monitoring
- Adding data backup strategies

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
- **Video Link:** https://drive.google.com/drive/folders/1QhOz70M1ScuyNfQ6Qq00bCrj7qJdkCJB?usp=sharing


---
## 📄 License

This project is created for demonstration purposes. Feel free to use as a learning resource or foundation for your own projects.

## 🙏 Acknowledgments

- FastAPI for the excellent Python web framework
- React team for the powerful frontend library
- MySQL for reliable data storage
- All the open-source libraries that made this possible

