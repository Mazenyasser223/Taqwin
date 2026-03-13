# Taqwin Frontend (React + TypeScript)

Modern, AI-powered fitness ecosystem interface with 3D graphics and smooth animations.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```env
   # Create .env file
   VITE_API_URL=http://localhost:4000
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

Frontend runs at `http://localhost:3000`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Tech Stack

- **React 19** with TypeScript
- **Vite** for blazing fast builds
- **React Router 7** (HashRouter)
- **Zustand** for state management
- **Tailwind CSS** for styling
- **Three.js** for 3D graphics
- **Framer Motion** for animations
- **Recharts** for data visualization
- **Google GenAI** for AI chat features

## Project Structure

```
frontend/
├── 3d/                    # 3D components (Three.js)
├── components/
│   ├── shared/           # Reusable components
│   └── ui/               # Layout components
├── features/             # Feature-based pages
│   ├── auth/            # Authentication
│   ├── dashboard/       # Dashboards
│   ├── workouts/        # Workout library
│   ├── nutrition/       # Nutrition tracking
│   ├── community/       # Social feed
│   ├── marketplace/     # Product marketplace
│   ├── trainers/        # Trainer management
│   └── gyms/            # Gym management
├── services/            # API client services
├── store/               # Zustand stores
├── lib/                 # Utilities
└── types.ts             # TypeScript definitions
```

## Key Features

- 🎨 **Modern UI**: Glass morphism design with dark theme
- ✨ **3D Graphics**: Interactive 3D backgrounds and visualizations
- 🎬 **Smooth Animations**: Page transitions and micro-interactions
- 📱 **Responsive**: Works on all devices
- 🤖 **AI Integration**: Google GenAI powered chat assistant
- 🔐 **Secure Auth**: JWT + Google OAuth
- 📊 **Real-time Charts**: Interactive data visualizations

## Environment Variables

- `VITE_API_URL` - Backend API URL (default: http://localhost:4000)
- `GEMINI_API_KEY` - Google GenAI API key for AI features

Get your Gemini API key from: https://makersuite.google.com/app/apikey

## Documentation

For complete documentation, see the [main README](../README.md) and [docs](../docs/) folder.

## Design System

- **Primary Color**: `#158b8d` (Teal)
- **Accent Color**: `#f37021` (Orange)
- **Font**: Space Grotesk
- **Icons**: Material Symbols

## Performance

- Lazy loading for routes
- Performance mode toggle (disables 3D)
- Reduced motion support
- Optimized bundle size
