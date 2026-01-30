# Setup Guide

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Google AI API key (for Gemini models)
- Backblaze B2 account and credentials
- OpenAI API key (optional, for DALL-E models)

## Initial Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Google AI (Gemini) - Required
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# Backblaze B2 Storage - Required
B2_S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_S3_REGION=us-west-004
B2_S3_BUCKET=your-bucket-name
B2_S3_ACCESS_KEY_ID=your_b2_key_id
B2_S3_SECRET_ACCESS_KEY=your_b2_secret_key
B2_S3_PRESIGN_TTL_SECONDS=900

# OpenAI (DALL-E) - Optional
OPENAI_API_KEY=your_openai_api_key_here
```

**Getting API Keys:**

- **Google AI (Gemini):** Get your free API key at [https://ai.google.dev](https://ai.google.dev)
- **Backblaze B2:** Sign up at [https://www.backblaze.com/b2](https://www.backblaze.com/b2)
  - Create a bucket
  - Generate S3-compatible application keys
- **OpenAI:** Get API key at [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### 3. Initialize Database

The database will be automatically created when you run the app for the first time. To manually initialize it:

```bash
# Create the data directory
mkdir -p data

# Push the database schema
pnpm run db:push
```

This creates a fresh SQLite database at `data/sqlite.db`.

### 4. Run the Development Server

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Management

### View Database Contents

```bash
pnpm run db:studio
```

This opens Drizzle Studio to browse your database.

### Reset Database

To start with a clean database:

```bash
# Remove existing database
rm -f data/sqlite.db data/sqlite.db-journal

# Recreate schema
pnpm run db:push
```

## Production Deployment

### Build the Application

```bash
pnpm run build
pnpm start
```

### Environment Variables

Make sure all environment variables are set in your production environment.

## Troubleshooting

### "API quota exceeded" errors

- **Gemini API:** Free tier has daily limits. Wait 24 hours or upgrade at [https://ai.google.dev/pricing](https://ai.google.dev/pricing)
- Check current usage at [https://ai.dev/rate-limit](https://ai.dev/rate-limit)

### Database errors

- Ensure the `data/` directory exists and is writable
- Run `pnpm run db:push` to recreate the schema

### Image upload/download errors

- Verify B2 credentials are correct
- Ensure the bucket exists and is accessible
- Check bucket permissions allow read/write access

## Project Structure

```
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   ├── lib/
│   │   ├── db/          # Database schema and client
│   │   ├── flow/        # Image generation flow logic
│   │   ├── providers/   # AI provider integrations
│   │   └── storage/     # B2 storage client
│   └── types/           # TypeScript types
├── data/                # SQLite database (gitignored)
└── .env                 # Environment variables (gitignored)
```

## Features

- **Multi-model generation**: Compare outputs from Gemini Imagen and OpenAI DALL-E
- **Reference images**: Upload images to guide generation
- **Prompt flow visualization**: See the AI's thinking process in real-time
- **B2 cloud storage**: All images stored securely in Backblaze B2
- **Version tracking**: Multiple generations per request with version history
