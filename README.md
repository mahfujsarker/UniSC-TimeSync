# UniSC TimeSync - Timetable Management System

UniSC TimeSync is a full-stack timetable management application for planning, publishing, viewing, and selecting university classes. It supports administrator workflows for academic structure, teaching periods, rooms, tutors, class generation, and timetable scheduling, plus student workflows for timetable viewing and class enrolment.

## Current Features

### Admin

- Live dashboard with counts for degrees, courses, rooms, tutors, teaching periods, scheduled classes, room usage, and tutor workload.
- Degree and course management in one screen.
- UniSC degree/course URL import workflow with draft review before publishing.
- Academic year and teaching period management.
- UniSC academic calendar import, draft review, and publish workflow.
- Classroom CRUD with capacity, room type, and availability status.
- Tutor CRUD with availability by academic year, teaching period, weekday, and time.
- Class generation from enrolled student counts and room capacity.
- Room-based timetable scheduler with drag-and-drop placement.
- Auto scheduling for missing generated classes.
- Conflict checks for classroom bookings, tutor bookings, room type, duration, capacity, and tutor availability.
- Routine timetable view and export pages.
- Public read-only timetable page at `/view-only-timetable`.

### Student

- Student dashboard.
- Published timetable viewing.
- Class selection and enrolment.
- Personal class list with unenrol support.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS 4 |
| UI interaction | @hello-pangea/dnd |
| API client | Axios with JWT token interceptor |
| Backend | Node.js, Express 4 |
| Database | PostgreSQL |
| Auth | JWT access/refresh tokens, bcryptjs |

## Project Structure

```text
timesync/
|-- backend/
|   |-- config/          PostgreSQL connection pool
|   |-- controllers/     API business logic
|   |-- db/              schema.sql, seed.sql, init-db.js, migration.sql
|   |-- middleware/      JWT auth and role checks
|   |-- routes/          Express route definitions
|   |-- utils/           schema compatibility helpers
|   |-- package.json
|   `-- server.js        Express entry point
|-- frontend/
|   |-- public/          static assets
|   |-- src/
|   |   |-- api/         Axios instance
|   |   |-- components/  shared UI components
|   |   |-- context/     auth context
|   |   |-- pages/       admin, auth, and student pages
|   |   `-- utils/       timetable/export helpers
|   |-- package.json
|   `-- vite.config.js
`-- README.md
```

## Prerequisites

- Node.js 18 or newer
- PostgreSQL 14 or newer
- npm

## Backend Configuration

Create `backend/.env` if you need values different from the defaults:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=timesync_db

JWT_SECRET=replace-with-a-local-development-secret
JWT_REFRESH_SECRET=replace-with-a-local-refresh-secret
```

If these database variables are not set, the backend defaults to `localhost:5432`, user `postgres`, password `postgres`, and database `timesync_db`.

## Setup

### 1. Create the database

```bash
psql -U postgres -c "CREATE DATABASE timesync_db;"
```

### 2. Install backend dependencies and initialize tables

```bash
cd backend
npm install
npm run db:init
```

Optional sample data:

```bash
npm run db:seed
```

The optional seed file is intended for local demo data and includes sample academic records. It also creates `admin.timesync@usc.edu.au` with password `admin123` and `student.timesync@usc.edu.au` with password `student123`.

### 3. Install frontend dependencies

```bash
cd ../frontend
npm install
```

## Running Locally

Start the backend:

```bash
cd backend
npm run dev
```

Backend URL:

```text
http://localhost:5000
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

The Vite dev server proxies `/api` requests to `http://localhost:5000`.

## User Access

Public registration creates student accounts. To create an admin account manually in a local database, register a user first and then update that user's role in PostgreSQL:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin.timesync@usc.edu.au';
```

## Main Frontend Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/login` | Public | Sign in |
| `/register` | Public | Create student account |
| `/view-only-timetable` | Public | Read-only published timetable |
| `/admin` | Admin | Admin dashboard |
| `/admin/degrees` | Admin | Degree and course management |
| `/admin/trimesters` | Admin | Academic years and teaching periods |
| `/admin/classrooms` | Admin | Classroom management |
| `/admin/tutors` | Admin | Tutor and availability management |
| `/admin/timetable` | Admin | Class generation and scheduler |
| `/admin/timetable/routine/:trimesterId` | Admin | Routine timetable |
| `/admin/download-timetable` | Admin | Timetable export |
| `/admin/calendar` | Admin | Academic calendar |
| `/student` | Student | Student dashboard |
| `/student/timetable` | Student | View published timetable |
| `/student/select-classes` | Student | Select/enrol in classes |
| `/student/my-classes` | Student | View and drop enrolled classes |

## API Overview

| Resource | Base path | Notes |
| --- | --- | --- |
| Auth | `/api/auth` | Register, login, refresh, logout |
| Public timetable data | `/api/public` | Public read-only degrees, periods, timetable |
| Degrees | `/api/degrees` | CRUD plus import extract/publish |
| Courses | `/api/courses` | Course CRUD and degree/period filtering |
| Legacy course alias | `/api/units` | Backward-compatible alias for `/api/courses` |
| Teaching periods | `/api/trimesters` | Academic years, import, publish, CRUD |
| Classrooms | `/api/classrooms` | Room CRUD |
| Tutors | `/api/tutors` | Tutor CRUD |
| Tutor availability | `/api/tutor-availability` | Admin-only availability management |
| Classes | `/api/classes` | Generated class instances |
| Timetable | `/api/timetable` | Scheduled entries, kanban/grid data, conflict checks |
| Student | `/api/student` | Student timetable, enrolment, my classes, unenrol |
| Calendar | `/api/calendar` | Academic calendar |
| Health check | `/api/health` | Backend status |

## Database Notes

The current schema is PostgreSQL-based and uses UUID primary keys.

Important tables:

- `users`
- `degrees`
- `academic_years`
- `trimesters`
- `units`
- `unit_degrees`
- `unit_trimesters`
- `unit_offering_patterns`
- `degree_course_imports`
- `classrooms`
- `tutors`
- `tutor_units`
- `tutor_availability`
- `classes`
- `timetable_entries`
- `student_selections`
- `academic_calendar`
- `teaching_period_events`

Courses are stored in the legacy `units` table for database compatibility. The current API and UI use the term "courses", and `/api/units` remains as a legacy route alias.

## Useful Commands

Backend:

```bash
cd backend
npm run dev
npm start
npm run db:init
npm run db:seed
```

Frontend:

```bash
cd frontend
npm run dev
npm run build
npm run preview
npm run lint
```

## Security

- Passwords are hashed with bcryptjs.
- Access and refresh tokens are issued through JWT.
- Protected routes require a valid access token.
- Admin-only API actions use role-based middleware.
- PostgreSQL queries use parameterized statements.
- CORS defaults to the Vite frontend origin in development.
