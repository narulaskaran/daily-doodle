# AGENTS.md - Daily Doodle Web

## Deployment

**Vercel auto-deploys on every push to `main`.** No manual deployment needed - just commit and push, Vercel handles the rest.

## Project Structure

- `src/app/` - Next.js App Router pages
- `src/components/` - React components
- `public/` - Static assets
- `vercel.json` - Vercel configuration

## Commands

```bash
npm run dev    # Development server
npm run build  # Production build
npm run start  # Start production server
```

## Environment Variables

See `.env.example` for required variables. Key ones:
- `UPLOADTHING_TOKEN` - UploadThing API key
- `UPLOADTHING_APP_ID` - UploadThing app ID
