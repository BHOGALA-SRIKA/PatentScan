
"use client";

import { FormEvent, useEffect, useState } from "react";

type SearchMode = "keyword" | "semantic" | "hybrid";

type Patent = {
  patent_id: string | number;
  publication_number: string;
  title: string;
  abstract: string;
  publication_date: string | null;
  ipc_code: string | null;
  cpc_code: string | null;
  source_url: string | null;
  relevance_score: number | null;
  semantic_similarity: number | null;
  hybrid_score?: number | null;
};

type SearchLog = {
  search_id: number;
  query_text: string;
  search_type: string;
  results_count: number;
  duration_ms: number | null;
  created_at: string;
  domain: string | null;
  investigation_id: number | null;
};

type PatentRelationship = {
  source_publication_number: string;
  target_publication_number: string;
  relationship_type: string;
  description?: string;
  verified?: boolean;
  verification_source?: string;
  source_url?: string;
  target_url?: string;
};

type Investigation = {
  _id: string;
  investigation_name: string;
  technology_area: string;
  search_method: string;
  status: string;
  created_at: string | null;
};

type ClaimElement = {
  element_id: number;
  element_text: string;
  element_order: number;
};

type EvidenceMapping = {
  mapping_id: number;
  publication_number: string;
  patent_title: string;
  evidence_level: string;
  evidence_note: string | null;
};

const searchModes: {
  value: SearchMode;
  label: string;
  description: string;
}[] = [
  {
    value: "keyword",
    label: "Keyword Search",
    description:
      "Find patents matching words in titles and abstracts.",
  },
  {
    value: "semantic",
    label: "Semantic Search",
    description:
      "Find patents with conceptually similar meanings.",
  },
  {
    value: "hybrid",
    label: "Hybrid Search",
    description:
      "Combine keyword relevance and semantic similarity.",
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<"search" | "investigations" | "history">("search");
  const [query, setQuery] = useState("");
  const mode: SearchMode = "hybrid";
  const [results, setResults] = useState<Patent[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchHistory, setSearchHistory] = useState<SearchLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  // Investigation management
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [investigationName, setInvestigationName] = useState("");
  const [technologyArea, setTechnologyArea] = useState("");
  const [searchMethod, setSearchMethod] = useState("Hybrid Search");

  const [investigationLoading, setInvestigationLoading] = useState(false);
  const [investigationMessage, setInvestigationMessage] = useState("");

  // PostgreSQL claim analysis and evidence mapping
  const [claimTitle, setClaimTitle] = useState("");
  const [claimDescription, setClaimDescription] = useState("");
  const [claimText, setClaimText] = useState("");
  const [claimSaving, setClaimSaving] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");
  const [savedInvestigationId, setSavedInvestigationId] = useState<string>("");
  const [savedClaims, setSavedClaims] = useState<ClaimElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState("");
  const [selectedPatentId, setSelectedPatentId] = useState("");
  const [evidenceLevel, setEvidenceLevel] = useState("PARTIAL");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceSaving, setEvidenceSaving] = useState(false);
  const [evidenceMessage, setEvidenceMessage] = useState("");
 const [evidenceMappings, setEvidenceMappings] = useState<EvidenceMapping[]>([]);
  // MongoDB citation relationships, loaded per patent.
  const [relationshipsByPatent, setRelationshipsByPatent] =
    useState<Record<string, PatentRelationship[]>>({});

  const [expandedPatent, setExpandedPatent] =
    useState<string | null>(null);

  const [relationshipLoadingFor, setRelationshipLoadingFor] =
    useState<string | null>(null);

  const [relationshipErrors, setRelationshipErrors] =
    useState<Record<string, string>>({});

  useEffect(() => {
  void loadInvestigations();
}, []);

  // Load MongoDB relationships for a selected patent.
  async function loadRelationships(publicationNumber: string) {
    // Collapse the section if the same patent is clicked again.
    if (expandedPatent === publicationNumber) {
      setExpandedPatent(null);
      return;
    }

    setExpandedPatent(publicationNumber);

    // Reuse data already fetched for this patent.
    if (
      Object.prototype.hasOwnProperty.call(
        relationshipsByPatent,
        publicationNumber
      )
    ) {
      return;
    }

    setRelationshipLoadingFor(publicationNumber);

    setRelationshipErrors((previous) => {
      const updated = { ...previous };
      delete updated[publicationNumber];
      return updated;
    });

    try {
      const params = new URLSearchParams({
        publication_number: publicationNumber,
      });

      const response = await fetch(
        `/api/patents/relationships?${params.toString()}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to load patent relationships."
        );
      }

      setRelationshipsByPatent((previous) => ({
        ...previous,
        [publicationNumber]: data.relationships || [],
      }));
    } catch (err) {
      setRelationshipErrors((previous) => ({
        ...previous,
        [publicationNumber]:
          err instanceof Error
            ? err.message
            : "Unable to load patent relationships.",
      }));
    } finally {
      setRelationshipLoadingFor((current) =>
        current === publicationNumber ? null : current
      );
    }
  }

  // Load only the signed-in user's own search history.
  async function loadSearchHistory() {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await fetch("/api/patents/history?limit=100", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load search history.");
      setSearchHistory(data.history || []);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Unable to load search history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  // Search patents using the selected method.
  async function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const searchTerm = query.trim();

    if (!searchTerm) {
      setError("Enter a search term to find patents.");
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError("");
    setSearched(true);
    setResults([]);
    setExpandedPatent(null);

    try {
      const params = new URLSearchParams({
        q: searchTerm,
        mode,
        limit: "10",
      });

      const response = await fetch(
        `/api/patents/search?${params.toString()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to search patents."
        );
      }

      setResults(data.results || []);
    } catch (err) {
      setResults([]);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }



  async function loadInvestigations() {
  setInvestigationLoading(true);
  setInvestigationMessage("");

  try {
    const response = await fetch("/api/investigations");
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Unable to load investigations.");
    }

    setInvestigations(data.investigations || []);
  } catch (error) {
    console.error("Load investigations error:", error);
    setInvestigationMessage("Unable to load investigations.");
  } finally {
    setInvestigationLoading(false);
  }
}

async function createInvestigation(
  event: React.FormEvent<HTMLFormElement>
) {
  event.preventDefault();
  setInvestigationMessage("");

  try {
    const response = await fetch("/api/investigations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        investigation_name: investigationName,
        technology_area: technologyArea,
        search_method: searchMethod,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Unable to save investigation.");
    }

    setInvestigationName("");
    setTechnologyArea("");
    setInvestigationMessage("Investigation saved successfully.");

    await loadInvestigations();
  } catch (error) {
    console.error("Create investigation error:", error);

    setInvestigationMessage(
      error instanceof Error
        ? error.message
        : "Unable to save investigation."
    );
  }
}


  async function saveClaimAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClaimSaving(true);
    setClaimMessage("");
    setEvidenceMessage("");

    try {
      const claims = claimText.split("\n").map((item) => item.trim()).filter(Boolean);
      const response = await fetch("/api/claim-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: claimTitle.trim(),
          invention_description: claimDescription.trim(),
          claim_elements: claims,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to save claim analysis.");
      }

      setSavedInvestigationId(String(data.investigation.investigation_id));
      setSavedClaims(data.claim_elements || []);
      setSelectedElementId(data.claim_elements?.[0]?.element_id ? String(data.claim_elements[0].element_id) : "");
      setClaimMessage(`Saved investigation #${data.investigation.investigation_id} with ${(data.claim_elements || []).length} claim elements in PostgreSQL.`);
      await loadEvidenceMappings(data.claim_elements?.[0]?.element_id);
    } catch (err) {
      setClaimMessage(err instanceof Error ? err.message : "Unable to save claim analysis.");
    } finally {
      setClaimSaving(false);
    }
  }

  async function loadEvidenceMappings(elementIdValue?: number | string) {
    const id = String(elementIdValue || selectedElementId || "");
    if (!id) {
      setEvidenceMappings([]);
      return;
    }
    try {
      const response = await fetch(`/api/evidence-mappings?element_id=${encodeURIComponent(id)}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to load evidence mappings.");
      setEvidenceMappings(data.mappings || []);
    } catch (err) {
      setEvidenceMessage(err instanceof Error ? err.message : "Unable to load evidence mappings.");
    }
  }

  
function generateEvidenceNote() {
  const element = savedClaims.find(
    (item) => String(item.element_id) === String(selectedElementId)
  );

  const patent = results.find(
    (item) => String(item.patent_id) === String(selectedPatentId)
  );

  if (!element || !patent) {
    setEvidenceMessage("Select a claim element and a patent first.");
    return;
  }

  const claimText = String(element.element_text ?? "").trim();

  const patentText =
    `${patent.title ?? ""} ${patent.abstract ?? ""}`.toLowerCase();

  const stopWords = new Set([
    "this", "that", "with", "from", "using", "into", "based",
    "have", "has", "for", "and", "the", "are", "was", "were",
    "which", "when", "where", "their", "then", "than", "also",
    "such", "method", "system"
  ]);

  const words = [
    ...new Set(
      (claimText.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
        (word) => word.length > 3 && !stopWords.has(word)
      )
    )
  ];

  const matchingWords = words.filter((word) =>
    patentText.includes(word)
  );

  if (matchingWords.length > 0) {
    setEvidenceLevel("PARTIAL");

    setEvidenceNote(
      `Preliminary keyword screening found ${matchingWords.length} matching term(s): ${matchingWords.join(", ")}. This is a potential connection, not proof of patent support. Compare the original patent claims and description with this claim element: "${claimText}".`
    );
  } else {
    setEvidenceLevel("NONE");

    setEvidenceNote(
      `No significant keyword overlap was found in the available patent title and abstract. This does not prove the patent is unrelated. Check the full patent document before concluding that no support exists for this claim element: "${claimText}".`
    );
  }

  setEvidenceMessage(
    "Preliminary analysis generated. Verify the original patent before saving."
  );
}


  async function saveEvidenceMapping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEvidenceSaving(true);
    setEvidenceMessage("");
    try {
      const response = await fetch("/api/evidence-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          element_id: Number(selectedElementId),
          patent_id: Number(selectedPatentId),
          evidence_level: evidenceLevel,
          evidence_note: evidenceNote.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to save evidence mapping.");
      setEvidenceMessage("Evidence mapping saved in PostgreSQL.");
      await loadEvidenceMappings(selectedElementId);
    } catch (err) {
      setEvidenceMessage(err instanceof Error ? err.message : "Unable to save evidence mapping.");
    } finally {
      setEvidenceSaving(false);
    }
  }

  // Return the score appropriate to the selected search method.
  function getScore(patent: Patent) {
    if (mode === "semantic") {
      return {
        label: "Semantic similarity",
        value: patent.semantic_similarity,
      };
    }

    if (mode === "hybrid") {
      return {
        label: "Hybrid score",
        value: patent.hybrid_score,
      };
    }

    return {
      label: "Keyword relevance",
      value: patent.relevance_score,
    };
  }

  function getPatentUrl(
    publicationNumber: string,
    providedUrl?: string
  ) {
    return (
      providedUrl ||
      `https://patents.google.com/patent/${encodeURIComponent(
        publicationNumber
      )}/en`
    );
  }

  async function handleLogout() {
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Logout failed. Please try again.");
      }

      window.location.replace("/login");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to log out.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Patent<span className="text-cyan-400">Scan</span>
            </h1>

            <p className="mt-1 text-xs text-slate-400">
              Hybrid Patent Prior-Art Search &amp; Claim Analysis
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-cyan-800 bg-cyan-950/50 px-3 py-1 text-xs text-cyan-300">
              Research Prototype
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-red-500/70 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-2 px-6 py-3">
          {[
            { id: "search", label: "Patent Search" },
            { id: "investigations", label: "Investigations & Claims" },
            { id: "history", label: "Search History" },
          ].map((tab) => (
            <button key={tab.id} type="button" onClick={() => { const nextTab = tab.id as typeof activeTab; setActiveTab(nextTab); if (nextTab === "history") void loadSearchHistory(); }} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id ? "bg-cyan-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-10">
        {/* Hero */}
        <div className="mb-8 text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">
            Discover related inventions
          </p>

          <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
            Search patents.
            <br />
            <span className="text-cyan-400">
              Explore prior art.
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-slate-400">
            Search patent titles and abstracts using keyword
            matching, semantic similarity, or a hybrid approach
            to discover potentially related inventions.
          </p>
        </div>

        {activeTab === "history" && (
          <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Your Search History</h2>
                <p className="mt-1 text-sm text-slate-400">Only searches made by your signed-in account are shown here.</p>
              </div>
              <button type="button" onClick={() => void loadSearchHistory()} disabled={historyLoading}
                className="rounded-xl border border-cyan-700 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-950 disabled:opacity-50">
                {historyLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            {historyError && <p role="alert" className="rounded-lg bg-red-950/40 p-3 text-sm text-red-300">{historyError}</p>}
            {historyLoading && searchHistory.length === 0 ? (
              <p className="text-sm text-slate-400">Loading your search history...</p>
            ) : searchHistory.length === 0 ? (
              <p className="rounded-xl bg-slate-950 p-5 text-sm text-slate-400">No searches have been recorded for your account yet.</p>
            ) : (
              <div className="space-y-3">
                {searchHistory.map((item) => (
                  <article key={item.search_id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-semibold text-white">{item.query_text}</h3>
                      <span className="rounded-full bg-cyan-950 px-3 py-1 text-xs text-cyan-300">{item.search_type}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                      <span>Results: {item.results_count}</span>
                      <span>Duration: {item.duration_ms == null ? "Not recorded" : `${item.duration_ms} ms`}</span>
                      {item.domain && <span>Domain: {item.domain}</span>}
                      {item.investigation_id != null && <span>Investigation: #{item.investigation_id}</span>}
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "search" && (
        <div className="space-y-6">
        {/* Patent Search Form */}
        
{/* Patent Search Form */}
<form
  onSubmit={handleSearch}
  className="mx-auto max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
>
  <label htmlFor="patent-query" className="sr-only">
    Patent search query
  </label>

  <input
    id="patent-query"
    value={query}
    onChange={(event) => setQuery(event.target.value)}
    placeholder="Describe your invention or technology..."
    className="mb-3 w-full rounded-xl bg-slate-800 px-5 py-4 text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500"
  />

  <button
    type="submit"
    disabled={loading}
    className="w-full rounded-xl bg-cyan-500 px-8 py-4 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {loading ? "Searching..." : "Search Patents"}
  </button>

  <p className="mt-3 text-center text-sm text-slate-400">
    PatentScan automatically retrieves and ranks relevant patents.
  </p>
</form>


        {/* Suggested Queries */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="mr-1 text-slate-500">Try:</span>

          {[
            "image",
            "recognition",
            "neural network",
            "recognizing objects using neural networks",
          ].map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => setQuery(term)}
              className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 transition hover:border-cyan-500 hover:text-cyan-300"
            >
              {term}
            </button>
          ))}
        </div>

        {/* Search Error */}
        {error && (
          <div
            role="alert"
            className="mx-auto mt-8 max-w-3xl rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-300"
          >
            {error}
          </div>
        )}

        {/* Search Results */}
        {searched && !loading && !error && (
          <div className="mt-12">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold">
                  Search Results
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {
                    searchModes.find((item) => item.value === mode)
                      ?.label
                  }
                </p>
              </div>

              <span className="text-sm text-slate-400">
                {results.length} result
                {results.length === 1 ? "" : "s"}
              </span>
            </div>

            {results.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
                <h4 className="text-lg font-semibold">
                  No matching patents found
                </h4>
                <p className="mt-2 text-slate-400">
                  Try a different query or switch the search method.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {results.map((patent) => {
                  const score = getScore(patent);
                  const publicationNumber =
                    patent.publication_number;

                  const isExpanded =
                    expandedPatent === publicationNumber;

                  const patentRelationships =
                    relationshipsByPatent[publicationNumber] || [];

                  const citedPatents = patentRelationships.filter(
                    (relationship) =>
                      relationship.source_publication_number ===
                      publicationNumber
                  );

                  const citingPatents = patentRelationships.filter(
                    (relationship) =>
                      relationship.target_publication_number ===
                      publicationNumber
                  );

                  return (
                    <article
                      key={patent.patent_id}
                      className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:border-cyan-800"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-cyan-400">
                            Publication No. {publicationNumber}
                          </p>

                          <h4 className="mt-2 text-xl font-semibold leading-snug">
                            {patent.title}
                          </h4>
                        </div>

                      
                      </div>

                      <p className="mt-4 leading-7 text-slate-300">
                        {patent.abstract}
                      </p>

                  

                      <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-400">
                        {patent.publication_date && (
                          <span className="rounded-full bg-slate-800 px-3 py-1">
                            Published:{" "}
                            {new Date(
                              patent.publication_date
                            ).toLocaleDateString()}
                          </span>
                        )}

                        {patent.ipc_code && (
                          <span className="rounded-full bg-slate-800 px-3 py-1">
                            IPC: {patent.ipc_code}
                          </span>
                        )}

                        {patent.cpc_code && (
                          <span className="rounded-full bg-slate-800 px-3 py-1">
                            CPC: {patent.cpc_code}
                          </span>
                        )}
                      </div>

                      {patent.source_url && (
                        <a
                          href={patent.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-5 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300"
                        >
                          View source patent ↗
                        </a>
                      )}

                      {/* MongoDB Citation Explorer */}
                      <div className="mt-5 border-t border-slate-800 pt-5">
                        <button
                          type="button"
                          onClick={() =>
                            loadRelationships(publicationNumber)
                          }
                          disabled={
                            relationshipLoadingFor ===
                            publicationNumber
                          }
                          aria-expanded={isExpanded}
                          className="rounded-xl border border-cyan-700 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-950 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {relationshipLoadingFor ===
                          publicationNumber
                            ? "Loading citations..."
                            : isExpanded
                              ? "Hide Citation Relationships"
                              : "View Citation Relationships"}
                        </button>

                        {isExpanded && (
                          <div className="mt-5 space-y-5">
                            {relationshipErrors[
                              publicationNumber
                            ] && (
                              <p
                                role="alert"
                                className="rounded-lg bg-red-950/40 p-3 text-sm text-red-300"
                              >
                                {
                                  relationshipErrors[
                                    publicationNumber
                                  ]
                                }
                              </p>
                            )}

                            {relationshipLoadingFor ===
                              publicationNumber && (
                              <p className="text-sm text-slate-400">
                                Fetching relationships from MongoDB...
                              </p>
                            )}

                            {!relationshipLoadingFor &&
                              !relationshipErrors[
                                publicationNumber
                              ] &&
                              Object.prototype.hasOwnProperty.call(
                                relationshipsByPatent,
                                publicationNumber
                              ) && (
                                <>
                                  <p className="text-sm text-slate-400">
                                    Found{" "}
                                    {patentRelationships.length}{" "}
                                    recorded relationship
                                    {patentRelationships.length === 1
                                      ? ""
                                      : "s"}{" "}
                                    in MongoDB.
                                  </p>

                                  {patentRelationships.length ===
                                    0 && (
                                    <p className="rounded-lg bg-slate-800 p-4 text-sm text-slate-300">
                                      No recorded citation
                                      relationships were found for
                                      this patent in PatentScan.
                                    </p>
                                  )}

                                  {/* Patents cited by this patent */}
                                  <section>
                                    <h5 className="mb-3 font-semibold text-cyan-300">
                                      Cites (
                                      {citedPatents.length})
                                    </h5>

                                    {citedPatents.length === 0 ? (
                                      <p className="text-sm text-slate-400">
                                        No outgoing citations are
                                        recorded.
                                      </p>
                                    ) : (
                                      <div className="space-y-3">
                                        {citedPatents.map(
                                          (relationship, index) => (
                                            <div
                                              key={`${relationship.source_publication_number}-${relationship.target_publication_number}-${index}`}
                                              className="rounded-xl bg-slate-800 p-4"
                                            >
                                              <p className="text-sm font-medium">
                                                {
                                                  relationship.target_publication_number
                                                }
                                              </p>

                                              {relationship.description && (
                                                <p className="mt-2 text-sm leading-6 text-slate-400">
                                                  {
                                                    relationship.description
                                                  }
                                                </p>
                                              )}

                                              <a
                                                href={getPatentUrl(
                                                  relationship.target_publication_number,
                                                  relationship.target_url
                                                )}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-3 inline-block text-sm text-cyan-400 hover:text-cyan-300"
                                              >
                                                View cited patent ↗
                                              </a>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    )}
                                  </section>

                                  {/* Patents that cite this patent */}
                                  <section>
                                    <h5 className="mb-3 font-semibold text-cyan-300">
                                      Cited by (
                                      {citingPatents.length})
                                    </h5>

                                    {citingPatents.length === 0 ? (
                                      <p className="text-sm text-slate-400">
                                        No incoming citations are
                                        recorded.
                                      </p>
                                    ) : (
                                      <div className="space-y-3">
                                        {citingPatents.map(
                                          (relationship, index) => (
                                            <div
                                              key={`${relationship.source_publication_number}-${relationship.target_publication_number}-${index}`}
                                              className="rounded-xl bg-slate-800 p-4"
                                            >
                                              <p className="text-sm font-medium">
                                                {
                                                  relationship.source_publication_number
                                                }
                                              </p>

                                              {relationship.description && (
                                                <p className="mt-2 text-sm leading-6 text-slate-400">
                                                  {
                                                    relationship.description
                                                  }
                                                </p>
                                              )}

                                              <a
                                                href={getPatentUrl(
                                                  relationship.source_publication_number,
                                                  relationship.source_url
                                                )}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-3 inline-block text-sm text-cyan-400 hover:text-cyan-300"
                                              >
                                                View citing patent ↗
                                              </a>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    )}
                                  </section>

                                  <p className="text-xs leading-5 text-slate-500">
                                    Citation relationships are
                                    recorded data for research
                                    purposes. Verify them against
                                    the original patent documents.
                                  </p>
                                </>
                              )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}


        </div>
        )}

        {activeTab === "investigations" && (
        <div className="space-y-8">
        {/* Investigation Management */}
<section
  id="investigations"
  className="mt-12 rounded-2xl border border-slate-800 bg-slate-900 p-6"
>
  <div className="mb-6">
    <h2 className="text-2xl font-bold text-white">
      Patent Investigations
    </h2>

    <p className="mt-2 text-sm leading-6 text-slate-400">
      Create and manage research investigations for inventions
      and their potential prior art.
    </p>
  </div>

  <form onSubmit={createInvestigation} className="space-y-4">
    <div>
      <label
        htmlFor="investigation-name"
        className="mb-2 block text-sm font-medium text-slate-300"
      >
        Investigation Name
      </label>

      <input
        id="investigation-name"
        type="text"
        required
        maxLength={150}
        value={investigationName}
        onChange={(event) =>
          setInvestigationName(event.target.value)
        }
        placeholder="e.g. Smart Agriculture Patent Research"
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
      />
    </div>

    <div>
      <label
        htmlFor="technology-area"
        className="mb-2 block text-sm font-medium text-slate-300"
      >
        Technology Area
      </label>

      <input
        id="technology-area"
        type="text"
        required
        maxLength={150}
        value={technologyArea}
        onChange={(event) =>
          setTechnologyArea(event.target.value)
        }
        placeholder="e.g. Computer Vision"
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
      />
    </div>

    <div>
      <label
        htmlFor="search-method"
        className="mb-2 block text-sm font-medium text-slate-300"
      >
        Preferred Search Method
      </label>

      <select
        id="search-method"
        value={searchMethod}
        onChange={(event) => setSearchMethod(event.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
      >
        <option>Keyword Search</option>
        <option>Semantic Search</option>
        <option>Hybrid Search</option>
      </select>
    </div>

    <button
      type="submit"
      className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
    >
      Save Investigation
    </button>

    {investigationMessage && (
      <p
        role="status"
        className="text-sm text-slate-300"
      >
        {investigationMessage}
      </p>
    )}
  </form>

  <div className="mt-8 border-t border-slate-800 pt-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-lg font-semibold text-white">
        Saved Investigations
      </h3>

      <button
        type="button"
        onClick={loadInvestigations}
        disabled={investigationLoading}
        className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
      >
        {investigationLoading ? "Loading..." : "Refresh"}
      </button>
    </div>

    {investigations.length === 0 && !investigationLoading ? (
      <p className="text-sm text-slate-400">
        No investigations loaded yet. Use Refresh to retrieve saved
        investigations.
      </p>
    ) : (
      <div className="grid gap-4 md:grid-cols-2">
        {investigations.map((investigation) => (
          <article
            key={String(investigation._id)}
            className="rounded-xl border border-slate-800 bg-slate-950 p-4"
          >
            <h4 className="font-semibold text-white">
              {investigation.investigation_name}
            </h4>

            <p className="mt-2 text-sm text-slate-400">
              Technology: {investigation.technology_area}
            </p>

            <p className="mt-1 text-sm text-slate-400">
              Search method: {investigation.search_method}
            </p>

            <p className="mt-1 text-sm text-slate-400">
              Status: {investigation.status}
            </p>

            <p className="mt-3 text-xs text-slate-500">
              Created:{" "}
              {investigation.created_at
                ? new Date(
                    investigation.created_at
                  ).toLocaleString()
                : "Unknown"}
            </p>
          </article>
        ))}
      </div>
    )}
  </div>
</section>

        {/* PostgreSQL Claim Analysis and Evidence Mapping */}
        <section id="claim-analysis" className="mt-12 rounded-2xl border border-cyan-900 bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Claim Analysis &amp; Evidence Mapping</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Save an invention and its claim elements in PostgreSQL, then map a claim element to one of the patent search results.</p>

          <form onSubmit={saveClaimAnalysis} className="mt-6 space-y-4">
            <div>
              <label htmlFor="claim-title" className="mb-2 block text-sm font-medium text-slate-300">Investigation title</label>
              <input id="claim-title" required maxLength={200} value={claimTitle} onChange={(e) => setClaimTitle(e.target.value)} placeholder="e.g. Smart Irrigation Patent Analysis" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </div>
            <div>
              <label htmlFor="claim-description" className="mb-2 block text-sm font-medium text-slate-300">Invention description</label>
              <textarea id="claim-description" required rows={3} value={claimDescription} onChange={(e) => setClaimDescription(e.target.value)} placeholder="Describe the invention and how it works" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </div>
            <div>
              <label htmlFor="claim-elements" className="mb-2 block text-sm font-medium text-slate-300">Claim elements (one per line)</label>
              <textarea id="claim-elements" required rows={4} value={claimText} onChange={(e) => setClaimText(e.target.value)} placeholder={'A soil moisture sensor measures soil moisture.\nA controller processes the readings.\nA pump waters the soil based on the readings.'} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white" />
            </div>
            <button type="submit" disabled={claimSaving} className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-60">{claimSaving ? "Saving..." : "Save Claim Analysis"}</button>
            {claimMessage && <p role="status" className="text-sm text-cyan-300">{claimMessage}</p>}
          </form>

          {savedClaims.length > 0 && <div className="mt-8 border-t border-slate-800 pt-6">
            <h3 className="text-lg font-semibold">Saved claim elements · Investigation #{savedInvestigationId}</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
              {savedClaims.map((claim) => <li key={claim.element_id}><span>{claim.element_text}</span> <span className="text-slate-500">(Element ID: {claim.element_id})</span></li>)}
            </ol>

            <form onSubmit={saveEvidenceMapping} className="mt-6 space-y-4 rounded-xl bg-slate-950 p-4">
              <h3 className="font-semibold">Map claim to a searched patent</h3>
              <p className="text-xs leading-5 text-amber-300">Run a patent search above first. Select a result below. Evidence classifications are for researcher review and should be checked against the original patent.</p>
              <div>
                <label htmlFor="mapping-element" className="mb-2 block text-sm text-slate-300">Claim element</label>
                <select id="mapping-element" required value={selectedElementId} onChange={(e) => { setSelectedElementId(e.target.value); void loadEvidenceMappings(e.target.value); }} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white">
                  {savedClaims.map((claim) => <option key={claim.element_id} value={String(claim.element_id)}>#{claim.element_order}: {claim.element_text}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="mapping-patent" className="mb-2 block text-sm text-slate-300">Patent search result</label>
                <select id="mapping-patent" required value={selectedPatentId} onChange={(e) => setSelectedPatentId(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white">
                  <option value="">Choose a patent from search results</option>
                  {results.map((patent) => <option key={patent.patent_id} value={String(patent.patent_id)}>{patent.publication_number} — {patent.title}</option>)}
                </select>
                {results.length === 0 && <p className="mt-2 text-xs text-slate-500">No current search results. Search for a patent first.</p>}
              </div>
              <div className="mt-4">
  <label className="mb-2 block text-sm font-medium">
    Evidence Classification
  </label>

  <select
    value={evidenceLevel}
    onChange={(e) =>
      setEvidenceLevel(
        e.target.value as "EXPLICIT" | "PARTIAL" | "NONE"
      )
    }
    className="w-full rounded-lg border border-gray-600 bg-gray-900 p-3 text-white"
  >
    <option value="EXPLICIT">Explicit support</option>
    <option value="PARTIAL">Partial support</option>
    <option value="NONE">No support identified</option>
  </select>
</div>
              <div>
                
<button
  type="button"
  onClick={generateEvidenceNote}
  className="mt-4 rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-black hover:bg-cyan-400"
>
  Generate Analysis
</button>

  <label
    htmlFor="evidence-note"
    className="mb-2 block text-sm text-slate-300"
  >
    Automatically Generated Review Note
  </label>

  <textarea
    id="evidence-note"
    rows={3}
    value={evidenceNote}
    readOnly
    placeholder="The review note will be generated automatically when you analyze the selected claim and patent."
    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
  />

  <p className="mt-2 text-xs text-slate-400">
    This preliminary explanation is generated from available patent
    information and should be verified against the original patent.
  </p>
</div>
              <button type="submit" disabled={evidenceSaving || !selectedElementId || !selectedPatentId} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{evidenceSaving ? "Saving mapping..." : "Save Evidence Mapping"}</button>
              {evidenceMessage && <p role="status" className="text-sm text-cyan-300">{evidenceMessage}</p>}
            </form>

            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Evidence mappings for selected claim</h3><button type="button" onClick={() => void loadEvidenceMappings()} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300">Refresh mappings</button></div>
              {evidenceMappings.length === 0 ? <p className="mt-3 text-sm text-slate-500">No mappings saved for this claim element yet.</p> : <div className="mt-3 space-y-3">{evidenceMappings.map((mapping) => <article key={mapping.mapping_id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><p className="font-medium">{mapping.publication_number} — {mapping.patent_title}</p><p className="mt-1 text-sm text-cyan-300">Evidence: {mapping.evidence_level}</p>{mapping.evidence_note && <p className="mt-2 text-sm text-slate-400">{mapping.evidence_note}</p>}</article>)}</div>}
            </div>
          </div>}
        </section>

        </div>
        )}

        {/* Feature Cards */}
        {activeTab === "search" && !searched && (
          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-2xl">⌕</div>
              <h3 className="mt-3 font-semibold">
                Keyword Search
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Match query terms against patent titles and
                abstracts using PostgreSQL full-text search.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-2xl">↕</div>
              <h3 className="mt-3 font-semibold">
                Semantic Search
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Use 384-dimensional text embeddings and pgvector
                to find conceptually related patents.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-2xl">▤</div>
              <h3 className="mt-3 font-semibold">
                Hybrid Search
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Combine keyword relevance and semantic similarity
                to rank candidate prior-art records.
              </p>
            </div>
          </div>
        )}


        


        {/* Disclaimer */}
        <p className="mt-12 text-center text-xs leading-6 text-slate-500">
          PatentScan is a research-support prototype. Recorded
          citations and search rankings do not establish patentability
          or provide legal advice. Always consult the original patent
          documents when evaluating prior art.
        </p>
      </section>
    </main>
  );
}
