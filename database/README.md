# Database Setup

This directory contains the MySQL database schema and setup files for SynergySphere.

## Prerequisites

- MySQL 8.0 or higher
- MySQL client or MySQL Workbench

## Setup Instructions

1. **Install MySQL** (if not already installed):
   - Download from https://dev.mysql.com/downloads/mysql/
   - Follow installation instructions for your OS
   - Make sure MySQL server is running

2. **Create Database and Tables**:
   ```bash
   mysql -u root -p < schema.sql
   ```

3. **Insert Sample Data** (optional):
   ```bash
   mysql -u root -p < sample_data.sql
   ```

## Database Configuration

Create a MySQL user for the application:

```sql
CREATE USER 'synergy_user'@'localhost' IDENTIFIED BY 'synergy_password';
GRANT ALL PRIVILEGES ON synergysphere.* TO 'synergy_user'@'localhost';
FLUSH PRIVILEGES;
```

## Database Schema

The database includes the following tables:

- **users**: User accounts with authentication
- **projects**: Project information and ownership
- **project_members**: Many-to-many relationship for project membership
- **tasks**: Task management with status tracking
- **comments**: Threaded comments for projects and tasks
- **notifications**: In-app notification system

## Connection Details

Default connection settings (update in backend `.env`):
- Host: `localhost`
- Port: `3306`
- Database: `synergysphere`
- Username: `synergy_user`
- Password: `synergy_password`

## Backup and Restore

**Backup:**
```bash
mysqldump -u root -p synergysphere > backup.sql
```

**Restore:**
```bash
mysql -u root -p synergysphere < backup.sql
```
