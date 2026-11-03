This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Patent Collector (Google Patents Scraper)

To collect genuine patent records from Google Patents and generate vector embeddings:

```bash
# Ensure pgvector-db container is active
docker start pgvector-db

# Run collector script
python scripts/patent_collector.py
```

### Safety & Features:
- Preserves all existing patent records and embeddings.
- Deduplicates on `publication_number`.
- Enforces rate limits with polite request delays.
- Targets authentic records in DBMS, Computer Networks, Cybersecurity, and AI/ML.
- Computes 384-dimensional dense vectors using `sentence-transformers/all-MiniLM-L6-v2`.
- Automatically populates both `patents` and `patent_embeddings` tables in PostgreSQL.

