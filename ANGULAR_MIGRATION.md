# Angular Migration Guide

This project has been migrated from vanilla JavaScript/HTML to Angular 17.

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── login/
│   │   ├── student-dashboard/
│   │   └── advisor-dashboard/
│   ├── services/
│   │   ├── auth.service.ts
│   │   └── api.service.ts
│   ├── guards/
│   │   └── auth.guard.ts
│   ├── app.component.ts
│   ├── app.module.ts
│   └── app-routing.module.ts
├── assets/
├── styles.scss
├── index.html
└── main.ts
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install Angular CLI globally (if not already installed):
```bash
npm install -g @angular/cli
```

## Development

Run both Angular frontend and Express backend:
```bash
npm run dev
```

Or run them separately:
- Angular dev server: `npm start` (runs on http://localhost:4200)
- Express server: `npm run server` (runs on http://localhost:4000)

## Building for Production

```bash
npm run build
```

The built files will be in `dist/student-retention/`

## Key Changes

1. **Components**: HTML pages converted to Angular components
2. **Services**: API calls moved to Angular services
3. **Routing**: Angular Router replaces manual navigation
4. **Forms**: Angular Reactive Forms replace vanilla form handling
5. **State Management**: Services manage authentication state

## Next Steps

The basic structure is in place. You may want to:

1. Complete the dashboard components with full functionality
2. Add Chart.js integration for analytics
3. Implement real-time features with WebSockets
4. Add more comprehensive error handling
5. Implement loading states and animations
6. Add unit tests

## Backend

The Express backend remains unchanged and continues to serve the API at `/api/*`. The Angular app communicates with it via HTTP requests.

