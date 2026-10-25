# PatentScan: Hybrid Patent Prior-Art Search & Claim Analysis System

PatentScan is a database-driven application designed to help researchers, student innovators, R&D teams, and intellectual property (IP) professionals explore potentially relevant existing patents for a proposed invention.

The system combines structured patent search, semantic similarity search, patent relationship data, and claim-level evidence mapping to support preliminary prior-art investigations.

> **Note:** PatentScan is a research-support tool. Its search results and evidence classifications require verification against original patent documents and do not constitute legal advice or a determination of patentability.

## Problem Statement

When developing a new invention, researchers need to investigate existing patents that may describe similar technologies. Relevant information can be distributed across patent metadata, abstracts, claims, and citation relationships.

PatentScan brings these data sources together in a single application to support patent discovery and preliminary claim analysis.

## Objectives

- Search patent records using structured metadata and text.
- Identify potentially relevant patents for an invention.
- Organize investigations and break invention descriptions into claim elements.
- Map claim elements to potentially relevant patents.
- Record preliminary evidence classifications and analysis notes.
- Explore patent relationships and metadata.
- Generate database reports to support analysis.

## Key Features

### 1. Patent Search
Search patent records using available patent metadata and text-based matching.

### 2. Investigation Management
Create investigations for proposed inventions and organize their associated claim elements and patent findings.

### 3. Claim-Level Analysis
Break an invention description into individual elements to support a more focused comparison with existing patents.

### 4. Evidence Mapping
Associate a claim element with a potentially relevant patent and record an evidence classification:

- **EXPLICIT:** Evidence appears to directly support the element; verify against the original patent.
- **PARTIAL:** Some potentially relevant information was identified.
- **NONE:** No support was identified by the preliminary screening.

The current keyword-based screening is preliminary and should not be treated as a definitive legal or technical conclusion.

### 5. Semantic Search
The project includes Python-based embedding and semantic-search components intended to help identify conceptually similar patent records.

### 6. Patent Relationships
MongoDB stores patent relationship data and related metadata to support exploration of connections between patents.

### 7. Database Reports
The application provides reports based on available database records, supporting analysis of patent metadata and investigation activity.

## Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| Frontend | Next.js, React, TypeScript | User interface |
| Backend | Next.js API routes | Application endpoints |
| Relational database | PostgreSQL | Structured patent and investigation records |
| Vector search | pgvector | Storing embeddings and supporting similarity search |
| NoSQL database | MongoDB | Patent relationships and additional metadata |
| Data processing | Python | Patent data processing and embedding utilities |
| Version control | Git and GitHub | Source-code management |

## Database Design

### PostgreSQL

The relational database contains tables for structured application data, including:

- `app_users` — application user records.
- `patents` — patent metadata.
- `investigations` — invention investigations.
- `claim_elements` — individual elements associated with investigations.
- `investigation_patents` — associations between investigations and patents.
- `evidence_mappings` — mappings between claim elements and patents.
- `search_logs` — search activity records.
- `patent_embeddings` — patent embeddings used for semantic search.

### pgvector

The `patent_embeddings` table stores vector representations of patent content. These embeddings can support semantic similarity comparisons between patent records and search queries when the corresponding embedding and search pipeline is configured.

### MongoDB

MongoDB stores patent relationship information and investigation-related metadata in collections such as:

- `patent_relationships`
- `investigation_metadata`

This hybrid architecture allows relational records, vector representations, and relationship-oriented data to be managed using suitable storage systems.

## System Architecture

1. Patent records are collected or imported into the system.
2. Structured patent information is stored in PostgreSQL.
3. Patent embeddings are stored in PostgreSQL using pgvector.
4. Patent relationship data and additional metadata are stored in MongoDB.
5. Users search for patents and create investigations.
6. Invention descriptions are organized into claim elements.
7. Potentially relevant patents are mapped to claim elements.
8. Evidence notes and classifications are saved for review.
9. Reports summarize information available in the databases.

## Project Structure

```text
PatentScan/
├── app/
│   ├── api/
│   │   ├── claim-analysis/
│   │   ├── evidence-mappings/
│   │   ├── health/
│   │   ├── investigations/
│   │   └── patents/
│   ├── patents/
│   └── page.tsx
├── data/
├── data_collection/
├── lib/
│   ├── mongodb.ts
│   └── postgres.ts
├── check_ipc_markers.py
├── embedding_service.py
├── generate_embeddings.py
├── import_patents.py
├── semantic_search.py
├── patents_dataset.csv
├── patents_dataset_enriched.csv
├── package.json
└── README.md
```

*The structure above highlights major project components; individual files and folders may change during development.*

## Setup and Installation

### Prerequisites

Install or configure:

- Node.js and npm.
- Python 3.
- PostgreSQL with the pgvector extension.
- MongoDB.
- Git.

Docker can be used to run PostgreSQL with pgvector.

### 1. Clone the repository

```bash
git clone https://github.com/BHOGALA-SRIKA/PatentScan.git
cd PatentScan
```

### 2. Install Node.js dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root and configure the PostgreSQL and MongoDB connection settings required by the application.

Use the variable names expected by the project's database connection modules.

**Do not commit `.env.local`, passwords, or API keys to GitHub.**

### 4. Prepare the databases

Create the PostgreSQL database and enable pgvector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Create the tables required by the application using the project's database setup scripts or SQL definitions.

Configure MongoDB and prepare the collections used by the application.

### 5. Start the development server

```bash
npm run dev
```

Open the application at:

http://localhost:3000

### 6. Check database connectivity

If the health endpoint is configured to check both databases, open:

http://localhost:3000/api/health

A successful response should indicate the connection status of the configured services.

## Example Workflow

1. Open PatentScan.
2. Search for patents using relevant terms.
3. Create an investigation for a proposed invention.
4. Enter the invention description and review the generated claim elements.
5. Select a claim element and a potentially relevant patent.
6. Generate a preliminary evidence note.
7. Review the suggested evidence classification.
8. Save the evidence mapping.
9. Review saved mappings and database reports.

## Limitations

- Search quality depends on the available patent data and metadata.
- Keyword overlap does not establish that a patent supports a claim element.
- Semantic search quality depends on the embedding model, indexed data, and retrieval implementation.
- The completeness of patent relationship information depends on the imported data.
- Original patent claims and descriptions must be checked before drawing conclusions about technical support or novelty.

## Future Enhancements

- Integrate additional authoritative patent data sources.
- Improve semantic retrieval and ranking.
- Support comparison against complete patent claims and descriptions.
- Add source citations and traceable evidence excerpts.
- Improve authentication and role-based access control.
- Add automated data refresh and import monitoring.
- Expand reporting and evaluation metrics.

## Intended Users

- Student innovators
- Patent researchers
- Research and development teams
- Intellectual property professionals

## Repository

GitHub: https://github.com/BHOGALA-SRIKA/PatentScan

## Disclaimer

PatentScan is an academic and research-support project. It does not replace professional legal advice, patent examination, or a formal prior-art search.
