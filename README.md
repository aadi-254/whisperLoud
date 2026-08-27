# WhisperLoud

WhisperLoud is a social discussion platform for sharing short thoughts, reacting to posts, writing replies, and following other users. The project uses a React/Vite frontend and a Node.js/Express backend with SQLite persistence.

## Contents

- [Overview](#overview)
- [Features](#features)
- [Software Requirements Specification](#software-requirements-specification)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Pages](#pages)
- [Navigation](#navigation)
- [Backend API](#backend-api)
- [Database](#database)
- [Images and Uploads](#images-and-uploads)
- [Installation](#installation)
- [Development](#development)
- [Admin Portal](#admin-portal)
- [Production Build](#production-build)
- [Security Notes](#security-notes)

## Overview

A user can create an account, sign in, publish thoughts, attach images, like or dislike thoughts, reply to posts, edit their profile, and follow or unfollow other users.

The application has two separately runnable projects:

- `frontend`: React application created with Vite.
- `backend`: Node.js and Express API server. It also serves the production React build.

The existing root-level EJS files and `server.js` are legacy files from the original application. The active split-project implementation is in `frontend` and `backend`.

## Features

### User features

- Landing page with product introduction and community guidelines.
- Account registration with username, email, and bcrypt password hashing.
- Sign in and sign out using HTTP-only cookies and an Express session.
- Feed of recent thoughts.
- Two-column responsive feed on larger screens and one column on mobile.
- Like and dislike actions with one vote per user per thought.
- Replies hidden by default and available through a `Replies` toggle.
- Create thoughts with optional image uploads.
- Editable profile information.
- Optional password change. Profile details can be updated without changing the password.
- Profile image upload.
- Clickable usernames on posts.
- Public profiles with follow and unfollow actions.
- Own profile with follower and following lists.
- Other profiles show follower and following counts only.

### Admin features

- Separate admin portal at `/admin`.
- Admin login.
- Member count, thought count, and reply count.
- View registered members.
- Remove thoughts.

## Software Requirements Specification

### Purpose

Provide a simple, responsive social platform where users can publish opinions and build connections through reactions, replies, and follows.

### Functional requirements

- FR-01: The system shall allow a user to register with a unique email address.
- FR-02: The system shall hash passwords before storing them.
- FR-03: The system shall authenticate users and maintain login state.
- FR-04: The system shall allow authenticated users to create text thoughts.
- FR-05: The system shall allow an optional image attachment on a thought.
- FR-06: The system shall allow authenticated users to like or dislike a thought.
- FR-07: The system shall prevent duplicate votes for the same user and thought.
- FR-08: The system shall allow authenticated users to add replies.
- FR-09: The system shall allow users to edit profile information.
- FR-10: The system shall allow users to change their profile image.
- FR-11: The system shall allow one user to follow or unfollow another user.
- FR-12: The system shall prevent a user from following themselves.
- FR-13: The system shall display follower and following relationships according to profile ownership rules.
- FR-14: The system shall provide an admin portal for moderation.
- FR-15: The system shall allow an admin to remove thoughts.

### Non-functional requirements

- NFR-01: The interface shall be responsive on desktop and mobile screens.
- NFR-02: Passwords shall never be stored as plain text.
- NFR-03: Database queries shall use parameterized values.
- NFR-04: Uploaded files shall be limited to image MIME types and 5 MB.
- NFR-05: Follow creation shall be idempotent.
- NFR-06: Protected user actions shall require authentication.
- NFR-07: The application shall preserve image aspect ratios when displaying images.

## Architecture

```text
Browser
  |
  | development: http://localhost:5173
  v
React + Vite frontend
  |
  | Vite proxy for API requests
  v
Express backend: http://localhost:3000
  |
  +-- SQLite database: ../whisperloud.sqlite
  +-- Upload storage: ../uploads
```

In development, Vite serves the React application and proxies API requests to Express. In production, Express serves `frontend/dist` after the frontend has been built.

## Project Structure

```text
WhisperLoud/
|
+-- frontend/
|   +-- src/
|   |   +-- components/
|   |   |   +-- Header.jsx
|   |   +-- pages/
|   |   |   +-- LandingPage.jsx
|   |   |   +-- LoginPage.jsx
|   |   |   +-- DashboardPage.jsx
|   |   |   +-- CreatePostPage.jsx
|   |   |   +-- ProfilePage.jsx
|   |   |   +-- UserProfilePage.jsx
|   |   |   +-- AdminPage.jsx
|   |   +-- App.jsx
|   |   +-- main.jsx
|   |   +-- index.css
|   +-- vite.config.js
|   +-- package.json
|   +-- dist/                 # Generated by npm run build
|
+-- backend/
|   +-- server.js             # Express server and API routes
|   +-- package.json
|   +-- package-lock.json
|
+-- whisperloud.sqlite        # Local SQLite database
+-- uploads/
|   +-- postphotos/
|   +-- profilephotos/
|
+-- views/                    # Legacy EJS views
+-- public/                   # Legacy frontend files
+-- server.js                 # Legacy root server file
```

## Pages

| URL | React page | Access |
| --- | --- | --- |
| `/` | `LandingPage` | Public |
| `/login` | `LoginPage` | Public |
| `/dashboard` | `DashboardPage` | Authenticated |
| `/createpost` | `CreatePostPage` | Authenticated |
| `/profile` | `ProfilePage` | Authenticated |
| `/user/:username` | `UserProfilePage` | Public page, follow action requires login |
| `/admin` | `AdminPage` | Admin login required for data |

### Page sections

- Landing: hero, introduction, feature tiles, community message, footer.
- Login: sign in and registration states.
- Dashboard: feed header, post cards, images, reactions, replies toggle, reply form.
- Create post: text editor, image selector, upload status, error feedback.
- Own profile: identity card, follower/following lists, editable profile form.
- Public profile: identity card, follow state, follower/following counts.
- Admin: authentication form, statistics, thought moderation, member list.

## Navigation

The shared navigation is implemented in `frontend/src/components/Header.jsx`.

- Signed out: Sign in, Join the room, Admin.
- Signed in: Room, Profile, Write, Sign out.
- Mobile: navigation links are hidden to keep the header compact. Direct URLs remain available.

## Backend API

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/signup` | Register a user. |
| `POST` | `/signin` | Authenticate a user. |
| `GET` | `/logout` | Clear user cookies and session. |
| `GET` | `/api/auth/me` | Return the current authentication state. |

### Thoughts and interactions

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/loadMorePosts?offset=0` | Load feed posts and comments. |
| `POST` | `/createPost` | Create a thought using multipart form data. |
| `POST` | `/vote` | Add one upvote or downvote. |
| `POST` | `/comment` | Add a reply to a thought. |

### Profiles and follows

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/profile` | Load the signed-in user's profile. |
| `PUT` | `/api/profile` | Update profile fields and optional image/password. |
| `GET` | `/api/users/:username` | Load a public profile and relationship data. |
| `POST` | `/api/users/:username/follow` | Follow a user. Duplicate requests are safe. |
| `DELETE` | `/api/users/:username/follow` | Unfollow a user. |

### Admin

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/admin/login` | Start an admin session. |
| `POST` | `/admin/logout` | End an admin session. |
| `GET` | `/admin/api/overview` | Load admin statistics and lists. |
| `DELETE` | `/admin/api/thoughts/:id` | Remove a thought. |

## Database

SQLite is opened at `whisperloud.sqlite` from `backend/server.js`. Tables are created with `CREATE TABLE IF NOT EXISTS` during backend startup.

### Tables

- `users`: accounts, profile fields, password hashes, and membership date.
- `thoughts`: post content, author, image URL, reaction counts, and comment count.
- `comments`: replies connected to thoughts and users.
- `votes`: one upvote or downvote per user and thought.
- `follows`: follower/following relationships with a unique pair constraint.

The follow schema is adapted to this project database:

```sql
CREATE TABLE follows (
  followerId INTEGER NOT NULL,
  followingId INTEGER NOT NULL,
  FOREIGN KEY (followerId) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (followingId) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE (followerId, followingId)
);
```

The supplied schema used `userinfo(userId)`. This project uses `users(user_id)`, so the foreign keys correctly reference the existing table.

## Images and Uploads

Multer is configured in `backend/server.js`.

- Post images are saved to `uploads/postphotos`.
- Profile images are saved to `uploads/profilephotos`.
- Upload folders are created automatically on startup.
- Only image MIME types are accepted.
- Maximum file size is 5 MB.
- Files are exposed through `/uploads/...`.
- Legacy Windows paths are normalized before being sent to React.
- CSS uses `max-width`, `max-height`, `width: auto`, and `height: auto` so images are reduced proportionally without cropping or stretching.

## Installation

Requirements:

- Node.js 18 or newer.
- npm.

Install frontend dependencies:

```powershell
cd frontend
npm install
```

Install backend dependencies:

```powershell
cd ../backend
npm install
```

The SQLite database is created automatically if it does not already exist.

## Development

Start the backend in one terminal:

```powershell
cd backend
npm run dev
```

Start the Vite frontend in another terminal:

```powershell
cd frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

The Vite proxy forwards API requests to `http://localhost:3000`.

If a port is already occupied on Windows, find the process with:

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,5173 }
```

Stop only the process that belongs to this project before restarting the server.

## Admin Portal

Open:

```text
http://localhost:5173/admin
```

Default development credentials:

```text
Username: admin
Password: admin
```

The admin portal is session-protected. The credentials are currently defined in `backend/server.js` and should be moved to environment variables before production deployment.

## Production Build

Build the React frontend:

```powershell
cd frontend
npm run build
```

Start Express:

```powershell
cd ../backend
npm start
```

Express serves the generated files from `frontend/dist` and the API from the same origin.

## Security Notes

- Replace the session secret in `backend/server.js` with a strong environment variable.
- Move admin credentials to environment variables or a database-backed admin account.
- Set `NODE_ENV=production` when using HTTPS so authentication cookies receive the `Secure` flag.
- Add CSRF protection and rate limiting before public deployment.
- Do not expose SQLite or upload directories for direct filesystem access.
- Review `npm audit` warnings before production deployment.

## Validation

The current project has been validated with:

```powershell
cd frontend
npm run build

cd ../backend
node --check server.js
```
