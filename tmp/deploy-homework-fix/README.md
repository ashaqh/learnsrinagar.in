# LMS v2 - Learning Management System

A comprehensive Learning Management System built with Remix.js, React, and MySQL for educational institutions in Srinagar.

## 🚨 Project Status: INCOMPLETE

**Current State:** This project contains only the database schema and package configuration. The actual application code (routes, components, utilities) is missing.

**What's Available:**
- ✅ Database schema (`learnsrinagar.sql`)
- ✅ Package dependencies (`package.json`)
- ❌ Application source code
- ❌ Routes and components
- ❌ Database connection setup
- ❌ Authentication logic
- ❌ UI components

## 🏗️ System Architecture

### Database Schema Overview
The system supports a multi-role educational platform with:

**User Roles:**
- Super Admin
- School Admin  
- Class Admin
- Teacher
- Student
- Parent

**Core Features:**
- Multi-school management
- Class and subject management
- Live class scheduling (Zoom integration)
- Homework assignment system
- Student attendance tracking
- Parent feedback system
- Teacher-subject assignments

## 🛠️ Technology Stack

- **Frontend:** React 18, Remix.js v2
- **Styling:** Tailwind CSS v4, Radix UI components
- **Database:** MySQL 8.0
- **Authentication:** bcryptjs for password hashing
- **Charts:** Recharts
- **Date Handling:** date-fns
- **Build Tool:** Vite 6.0

## 📋 Prerequisites

- Node.js >= 20.0.0
- MySQL 8.0 or higher
- npm or yarn package manager

## 🚀 Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Navigate to project directory
cd proj14

# Install dependencies
npm install

# If you encounter dependency conflicts, use:
npm install --legacy-peer-deps
```

### 2. Database Setup

```bash
# Create MySQL database
mysql -u root -p
CREATE DATABASE learnsrinagar;
exit

# Import the database schema
mysql -u root -p learnsrinagar < learnsrinagar.sql
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=learnsrinagar

# Application Configuration
SESSION_SECRET=your_session_secret_key
NODE_ENV=development

# Zoom Integration (if needed)
ZOOM_API_KEY=your_zoom_api_key
ZOOM_API_SECRET=your_zoom_api_secret
```

### 4. Missing Implementation Requirements

To complete this project, you need to implement:

#### Core Application Structure
```
app/
├── routes/
│   ├── _index.tsx                 # Landing page
│   ├── login.tsx                  # Authentication
│   ├── dashboard/
│   │   ├── _layout.tsx           # Dashboard layout
│   │   ├── admin/                # Admin routes
│   │   ├── teacher/              # Teacher routes
│   │   ├── student/              # Student routes
│   │   └── parent/               # Parent routes
│   └── api/                      # API routes
├── components/
│   ├── ui/                       # Reusable UI components
│   ├── forms/                    # Form components
│   └── layout/                   # Layout components
├── lib/
│   ├── db.server.ts              # Database connection
│   ├── auth.server.ts            # Authentication logic
│   └── utils.ts                  # Utility functions
└── styles/
    └── tailwind.css              # Tailwind styles
```

#### Database Connection Setup
```typescript
// app/lib/db.server.ts
import mysql from 'mysql2/promise';

export const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
```

#### Authentication System
```typescript
// app/lib/auth.server.ts
import bcrypt from 'bcryptjs';
import { db } from './db.server';

export async function authenticateUser(email: string, password: string) {
  // Implementation needed
}

export async function createUserSession(userId: string, redirectTo: string) {
  // Implementation needed
}
```

### 5. Development Commands

```bash
# Start development server (once implemented)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📊 Database Schema Details

### Key Tables:
- **users**: Core user management with role-based access
- **schools**: Multi-school support
- **classes**: Grade/class management (6, 7, 8)
- **subjects**: Subject management per class
- **live_classes**: Zoom integration for online classes
- **homework**: Assignment management
- **student_attendance**: Attendance tracking
- **parent_feedback**: Parent feedback system

### Sample Data Included:
- 12 schools in Srinagar region
- 3 classes (6, 7, 8)
- 6 subjects (English, Urdu, Mathematics, Science, Social Science, Kashmiri)
- Multiple user roles with sample accounts

## 🔐 Default Login Credentials

```
Super Admin:
Email: super_admin@gmail.com
Password: [Check database for hashed password]

School Admin (BMS Noorbagh):
Email: bmsnoorbagh@learnsrinagar.in
Password: [Check database for hashed password]
```

## 🎯 Next Steps to Complete the Project

1. **Implement Authentication System**
   - Login/logout functionality
   - Role-based route protection
   - Session management

2. **Create Dashboard Layouts**
   - Role-specific dashboards
   - Navigation components
   - Responsive design

3. **Build Core Features**
   - User management
   - School administration
   - Class and subject management
   - Live class scheduling
   - Homework system
   - Attendance tracking

4. **Add UI Components**
   - Forms for data entry
   - Tables for data display
   - Charts for analytics
   - Modal dialogs

5. **Implement API Routes**
   - CRUD operations for all entities
   - File upload handling
   - Real-time updates

## 🤝 Contributing

This project is currently incomplete. To contribute:

1. Implement missing application code
2. Follow Remix.js best practices
3. Use TypeScript for type safety
4. Implement proper error handling
5. Add comprehensive testing

## 📝 License

[Add your license information here]

## 🔧 Troubleshooting

### Dependency Conflicts
If you encounter npm dependency resolution errors:

```bash
# Option 1: Use legacy peer deps
npm install --legacy-peer-deps

# Option 2: Use force flag (not recommended)
npm install --force

# Option 3: Clear cache and retry
npm cache clean --force
npm install
```

### Common Issues
- **MySQL Connection**: Ensure MySQL service is running and credentials are correct
- **Node Version**: Verify Node.js >= 20.0.0 is installed
- **Port Conflicts**: Default dev server runs on port 3000

## 📞 Support

For questions about this educational management system, please contact the development team.

---

**Note:** This README reflects the current incomplete state of the project. Update this document as you implement the missing features.