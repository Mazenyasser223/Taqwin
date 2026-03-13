# Taqwin - AI-Powered Fitness Ecosystem 🏋️

A comprehensive fitness management platform that connects athletes, trainers, and gym owners in one unified ecosystem powered by AI.

## 🌟 Project Overview

Taqwin is a graduation project that provides:
- **For Athletes**: Personalized workout plans, nutrition tracking, AI coaching, and progress analytics
- **For Trainers**: Client management, custom workout/nutrition plans, and business tools
- **For Gym Owners**: Complete gym management system, member tracking, equipment management, and analytics

## 🏗️ Architecture

### Technology Stack

#### Frontend
- **Framework**: React 19.2.4 with TypeScript
- **Build Tool**: Vite 6.2.0
- **Router**: React Router DOM 7 (HashRouter)
- **State Management**: Zustand 5.0.11
- **Styling**: Tailwind CSS
- **3D Graphics**: Three.js + React Three Fiber
- **Animations**: Framer Motion
- **Charts**: Recharts
- **AI Integration**: Google GenAI SDK

#### Backend
- **Runtime**: Node.js (>=18)
- **Framework**: Express.js
- **Database**: PostgreSQL (AWS RDS)
- **ORM**: Prisma
- **Authentication**: JWT + Passport.js (Google OAuth)
- **Email**: Nodemailer (Gmail SMTP)

#### Databases (AWS Services)
- **PostgreSQL** (AWS RDS): User data, profiles, authentication
- **MongoDB** (Planned): Community posts, social features
- **Redis** (Planned): Caching, session management
- **S3**: Media storage (images, videos)

## 📁 Project Structure

```
Taqwin/
├── backend-node/              # Node.js Express backend
│   ├── src/
│   │   ├── index.js          # Server entry point
│   │   ├── app.js            # Express app configuration
│   │   ├── db.js             # Prisma client
│   │   ├── config/           # Configuration files
│   │   ├── middleware/       # Auth middleware
│   │   ├── routes/           # API routes
│   │   └── services/         # Business logic
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── migrations/       # Database migrations
│   └── package.json
│
├── frontend/                  # React TypeScript frontend
│   ├── 3d/                   # 3D components (Three.js)
│   ├── components/           # Reusable UI components
│   ├── features/             # Feature-based pages
│   │   ├── auth/            # Authentication pages
│   │   ├── dashboard/       # Dashboard views
│   │   ├── workouts/        # Workout library
│   │   ├── nutrition/       # Nutrition tracking
│   │   ├── community/       # Social feed
│   │   ├── marketplace/     # Product marketplace
│   │   ├── trainers/        # Trainer management
│   │   └── gyms/            # Gym management
│   ├── services/             # API client services
│   ├── store/                # Zustand state stores
│   ├── lib/                  # Utilities
│   └── types.ts              # TypeScript definitions
│
└── docs/                      # Documentation
    ├── DATABASE-DESIGN.md
    ├── AWS-SETUP.md
    ├── GOOGLE-OAUTH-SETUP.md
    └── ...
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- PostgreSQL (or AWS RDS access)
- Google OAuth credentials (for social login)
- Gmail App Password (for email verification)
- Google GenAI API key (for AI features)

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend-node
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the following:
     ```env
     PORT=4000
     DATABASE_URL=your_postgresql_connection_string
     JWT_SECRET=your_jwt_secret_min_32_chars
     GOOGLE_CLIENT_ID=your_google_client_id
     GOOGLE_CLIENT_SECRET=your_google_client_secret
     GMAIL_USER=your_gmail@gmail.com
     GMAIL_APP_PASSWORD=your_app_password
     FRONTEND_URL=http://localhost:3000
     ```

4. Run database migrations:
   ```bash
   npm run db:migrate
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

Backend will be available at `http://localhost:4000`

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Create a `.env` file:
     ```env
     VITE_API_URL=http://localhost:4000
     GEMINI_API_KEY=your_gemini_api_key
     ```

4. Start the development server:
   ```bash
   npm run dev
   ```

Frontend will be available at `http://localhost:3000`

## 🔐 Authentication System

### User Roles
- **Athlete**: Track workouts, get AI coaching
- **Trainer**: Manage clients, create plans
- **Gym Owner**: Manage gym operations

### Features
- ✅ Email/Password registration with verification
- ✅ Google OAuth integration
- ✅ JWT-based authentication
- ✅ Email verification (6-digit code, 15-min expiry)
- ✅ Role-based access control

## 📱 Key Features

### For Athletes
- 🤖 **AI Coach**: Personalized workout and nutrition recommendations
- 📊 **Dashboard**: Progress tracking, analytics, goals
- 💪 **Workout Library**: Exercises with instructions and videos
- 🥗 **Nutrition Tracking**: Food database, calorie counting, macros
- 🏋️ **Find Trainers**: Browse and book personal trainers
- 🏢 **Gym Finder**: Discover nearby gyms, check availability
- 🛒 **Marketplace**: Buy fitness products and supplements
- 👥 **Community**: Social feed, share progress, connect with others

### For Trainers
- 👤 **Client Management**: Track client progress and goals
- 📋 **Custom Plans**: Create personalized workout/nutrition plans
- 📈 **Analytics**: Monitor client performance
- 💬 **Communication**: Direct messaging with clients
- 📅 **Scheduling**: Manage appointments and sessions

### For Gym Owners
- 🏢 **Gym Dashboard**: Overview of operations, revenue, attendance
- 👥 **Member Management**: Track memberships, payments
- 🛠️ **Equipment Tracking**: Monitor equipment status, maintenance
- 👔 **Staff Management**: Manage employees, schedules
- 📊 **Analytics**: Business insights, revenue reports

## 🎨 Design System

### Colors
- **Primary**: `#158b8d` (Teal)
- **Accent**: `#f37021` (Orange)
- **Background**: `#0a161c` (Dark)
- **Surface**: `#112129` (Dark Blue-Gray)

### Features
- 🌗 Dark theme optimized for fitness environments
- ✨ Glass morphism design
- 🎭 3D animated backgrounds
- 🎬 Smooth page transitions
- 📱 Fully responsive

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/verify-email` - Verify email with code
- `POST /api/auth/resend-verification` - Resend verification code
- `GET /api/auth/me` - Get current user
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback

### Profile
- `GET /api/profile` - Get user profile
- `PATCH /api/profile` - Update profile

### Health Check
- `GET /health` - API health status

## 🧪 Testing

### Manual Testing Checklist

#### Authentication Flow
- [ ] Register new user (athlete)
- [ ] Receive verification email
- [ ] Verify email with 6-digit code
- [ ] Login with credentials
- [ ] Register with Google OAuth
- [ ] Logout and login again

#### User Roles
- [ ] Test athlete dashboard
- [ ] Test trainer dashboard (register as trainer)
- [ ] Test gym owner dashboard (register as gym owner)

#### Features
- [ ] Browse workout library
- [ ] Track nutrition
- [ ] Use AI chat assistant
- [ ] Browse marketplace
- [ ] View community feed
- [ ] Find trainers
- [ ] Find gyms

## 📚 Documentation

Detailed documentation available in `docs/`:
- [Database Design](docs/DATABASE-DESIGN.md)
- [AWS Setup Guide](docs/AWS-SETUP.md)
- [Google OAuth Setup](docs/GOOGLE-OAUTH-SETUP.md)
- [Email Verification Setup](docs/EMAIL-VERIFICATION-SETUP.md)
- [PostgreSQL Setup](docs/POSTGRES-WINDOWS-SETUP.md)

## 🔧 Development Scripts

### Backend
```bash
npm run dev           # Start development server with watch mode
npm run db:migrate    # Run database migrations
npm run db:generate   # Generate Prisma client
npm run db:studio     # Open Prisma Studio (database GUI)
```

### Frontend
```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run preview       # Preview production build
```

## 🌐 Deployment

### Backend (AWS EC2 / Elastic Beanstalk)
1. Set environment variables
2. Run migrations
3. Start with `npm start`

### Frontend (Vercel / Netlify / S3)
1. Build: `npm run build`
2. Deploy `dist/` folder
3. Configure environment variables

## 🔐 Security

- ✅ JWT authentication with secure tokens
- ✅ Password hashing with bcrypt
- ✅ Email verification required
- ✅ CORS configured for frontend
- ✅ Environment variables for secrets
- ✅ SQL injection prevention (Prisma ORM)

## 📈 Future Enhancements

- [ ] Real-time chat with WebSockets
- [ ] Video call integration for trainer sessions
- [ ] Mobile app (React Native)
- [ ] Advanced AI models (workout form analysis)
- [ ] Payment integration (Stripe)
- [ ] Push notifications
- [ ] Wearable device integration (Fitbit, Apple Watch)
- [ ] Social challenges and competitions

## 👥 Contributors

Graduation Project - Faculty of [Your Faculty Name]

## 📄 License

This project is for educational purposes as part of a graduation project.

## 🆘 Support

For issues or questions:
1. Check the documentation in `docs/`
2. Review the code comments
3. Contact the development team

---

**Built with ❤️ for the fitness community**
