# Copilot Instructions for QR Suite

## Project Overview

QR Suite is a comprehensive QR code generation and scanning application built with Next.js 14 and TypeScript. The application has been optimized for Telegram Mini App platform with full Telegram WebApp API integration, mobile-first responsive design, and native-feeling interactions.

## Technology Stack

- **Framework**: Next.js 14.1.0 with App Router
- **Language**: TypeScript 5.3.3 (strict mode enabled)
- **UI Library**: React 18.2.0
- **Telegram Integration**: @twa-dev/sdk 8.0.2
- **QR Code Libraries**: 
  - qrcode 1.5.3 (generation)
  - @zxing/browser 0.1.5 (scanning)
  - qr-code-styling 1.6.0 (styling)
- **Data Processing**: papaparse, xlsx, jszip
- **Storage**: idb (IndexedDB wrapper)

## Project Structure

```
src/
├── app/              # Next.js app router pages and layouts
├── components/       # React components
│   ├── ui/          # Reusable UI components
│   ├── Generator.tsx
│   ├── BatchGenerator.tsx
│   └── Scanner.tsx
├── hooks/           # Custom React hooks (Telegram integration)
├── lib/             # Utility libraries and helpers
├── providers/       # React context providers (TelegramThemeProvider)
├── styles/          # Global and theme CSS files
├── types/           # TypeScript type definitions
└── workers/         # Web Workers for heavy computations

tests/               # Test files using Node.js test runner
```

## Development Commands

- **Development server**: `npm run dev` - Starts Next.js dev server on port 3000
- **Build**: `npm run build` - Creates production build
- **Start production**: `npm start` - Runs production server
- **Lint**: `npm run lint` - Runs ESLint with Next.js config
- **Type check**: `npm run typecheck` - Runs TypeScript compiler without emitting files
- **Test**: `npm test` - Runs typecheck and Node.js test runner

## Code Style and Conventions

### TypeScript
- Strict mode is enabled in tsconfig.json
- Use explicit types for function parameters and return types
- Leverage TypeScript's type inference for local variables
- Use path aliases: `@/*` maps to `./src/*`

### React Components
- Use functional components with hooks
- Client components should have `'use client'` directive at the top
- Use dynamic imports with `next/dynamic` for code-splitting heavy components
- Implement loading states with Skeleton components for lazy-loaded components

### File Organization
- Component files use PascalCase: `Generator.tsx`, `BatchGenerator.tsx`
- Hook files use camelCase: `useMainButton.ts`, `useTelegramTheme.ts`
- Test files use `.test.mjs` extension
- CSS modules should be co-located with components

### Telegram Mini App Specific
- Always check for Telegram WebApp availability before using Telegram-specific features
- Use Telegram theme variables defined in `telegram-theme.css` for consistent styling
- Implement haptic feedback for user interactions where appropriate
- Follow mobile-first responsive design principles
- Ensure all interactive elements meet 44px minimum tap-target size

## Testing Approach

### Unit Tests
- Located in the `tests/` directory
- Use Node.js built-in test runner (`node --test`)
- Test file naming: `*.test.mjs`
- Focus on:
  - Core business logic (QR code generation, data processing)
  - Worker functionality
  - Type definitions and payload generation

### Type Safety
- TypeScript type checking is part of the test suite
- All code must pass `tsc --noEmit` before tests run
- No TypeScript errors are acceptable

### Test Execution
Tests run in this order:
1. TypeScript type checking (`npm run typecheck`)
2. Node.js test runner for unit tests

## Performance Considerations

- Heavy components (BatchGenerator, Scanner) are lazy-loaded to reduce initial bundle size
- Web Workers are used for CPU-intensive operations
- Code-splitting is implemented using Next.js dynamic imports
- Skeleton screens provide instant feedback during lazy loading

## Theme System

The app uses Telegram's theme system with CSS custom properties:
- Variables are defined in `src/styles/telegram-theme.css`
- Theme automatically switches based on Telegram's light/dark mode
- Falls back to default light theme when running outside Telegram
- Use theme variables for consistent styling: `var(--tg-bg)`, `var(--tg-text)`, etc.

## Dependencies Management

- Use npm for package management
- Keep dependencies minimal and well-maintained
- Check for security vulnerabilities before adding new packages
- Prefer TypeScript-first libraries or those with good type definitions

## Build and Deployment

- The app builds to static HTML/CSS/JS via Next.js
- Production build: `npm run build`
- Verify build succeeds and type checking passes before committing
- The app works both inside and outside Telegram context

## Common Patterns

### Adding a New QR Type
1. Define payload type in `src/types/`
2. Add encoder in `src/lib/qrTypes.ts`
3. Update type registry
4. Add tests in `tests/qrTypes.test.mjs`

### Working with Workers
- Workers are in `src/workers/`
- Use typed messages for communication
- Test worker functionality in `tests/*.worker.test.mjs`

### Telegram Features
- Use hooks from `src/hooks/` for Telegram functionality
- Wrap Telegram-specific code in availability checks
- Ensure graceful degradation when not in Telegram

## Key Files to Understand

- `src/app/layout.tsx` - Root layout with TelegramThemeProvider
- `src/app/page.tsx` - Main page with code-split components
- `src/lib/qrTypes.ts` - QR code type definitions and registry
- `src/providers/TelegramThemeProvider.tsx` - Telegram theme integration
- `package.json` - Scripts and dependencies
- `tsconfig.json` - TypeScript configuration with strict mode
