# TTMS — University Time Table Management System

A full-stack web application for managing university timetables with **Kanban-style drag-and-drop** interface.

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, TailwindCSS v4, @hello-pangea/dnd |
| **Backend** | Node.js, Express.js |
| **Database** | PostgreSQL |
| **Auth** | JWT (access + refresh tokens), bcrypt |

## 📁 Project Structure

```
ttms/
├── backend/           # Express API server
│   ├── config/        # Database connection
│   ├── controllers/   # Business logic (auth, CRUD, timetable, student)
│   ├── middleware/     # JWT auth & role-based access
│   ├── routes/        # API route definitions
│   ├── db/            # SQL schema + seed data
│   └── server.js      # Entry point
├── frontend/          # React SPA
│   └── src/
│       ├── api/       # Axios with JWT interceptor
│       ├── context/   # Auth state management
│       ├── components/# Shared UI (KanbanBoard, Modal, Toast, etc.)
│       └── pages/     # Admin + Student dashboards
└── README.md
```

## 🚀 Setup & Running

### Prerequisites

- **Node.js** v18+
- **PostgreSQL** v14+

### 1. Database Setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE ttms_db;"

# Initialize tables
cd ttms/backend
npm install
node db/init-db.js

# (Optional) Seed with sample data
node db/init-db.js --seed
```

### 2. Backend

```bash
cd ttms/backend

# Configure environment (edit .env if needed)
# Default: localhost:5432, postgres/postgres, ttms_db

npm install
npm run dev
# Server starts on http://localhost:5000
```

### 3. Frontend

```bash
cd ttms/frontend
npm install
npm run dev
# App opens at http://localhost:5173
```

## 👤 User Roles

### Admin
- Full CRUD for: Degrees, Trimesters, Units, Classrooms, Tutors, Calendar
- **Kanban timetable board** with drag-and-drop to assign/move classes
- Automatic **conflict detection** (room + tutor availability)

### Student
- View published timetable (read-only Kanban board)
- Browse and **enroll in classes** with capacity checks
- View **My Classes** schedule grouped by day
- Drop classes with unenroll

## 🔑 Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@ttms.edu | admin123 |
| Student | student@ttms.edu | student123 |

> ⚠️ Run `node db/init-db.js --seed` to create demo users.

## 📡 API Endpoints

| Resource | Methods | Auth |
|---|---|---|
| `/api/auth/register, login, refresh, logout` | POST | Public (register/login) |
| `/api/degrees` | GET, POST, PUT, DELETE | Admin (write) |  
| `/api/trimesters` | GET, POST, PUT, DELETE | Admin (write) |
| `/api/units` | GET, POST, PUT, DELETE | Admin (write) |
| `/api/classrooms` | GET, POST, PUT, DELETE | Admin (write) |
| `/api/tutors` | GET, POST, PUT, DELETE | Admin (write) |
| `/api/timetable` | GET, POST, PUT, DELETE | Admin (write) |
| `/api/timetable/kanban/:trimesterId` | GET | Auth required |
| `/api/timetable/check-conflicts` | POST | Admin |
| `/api/student/timetable` | GET | Auth required |
| `/api/student/enroll` | POST | Auth required |
| `/api/student/my-classes` | GET | Auth required |
| `/api/student/unenroll/:id` | DELETE | Auth required |
| `/api/calendar` | GET, POST, PUT, DELETE | Admin (write) |

## 🛡️ Security

- JWT access tokens (15min) + refresh tokens (7 days)
- bcrypt password hashing (10 rounds)
- Role-based access control middleware
- SQL parameterized queries (injection prevention)
- CORS configured for frontend origin
- Input validation on all endpoints

## 📊 Database Schema

9 relational tables with foreign keys:
`users`, `degrees`, `trimesters`, `units`, `classrooms`, `tutors`, `tutor_units`, `timetable_entries`, `student_selections`, `academic_calendar`

Unique constraints prevent:
- Double-booking classrooms (same room + day + time)
- Double-booking tutors (same tutor + day + time)
- Duplicate student enrollments
