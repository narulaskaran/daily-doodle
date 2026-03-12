'use client';

import { useState, useEffect, useCallback } from 'react';

interface Revision {
  id: string;
  attempt: number;
  imageUrl: string;
  reviewComment: string;
  chosen: boolean;
  createdAt: string;
}

interface GeneratedPage {
  id: string;
  prompt: string;
  imageUrl: string;
  fileKey: string;
  createdAt: string;
  approved: boolean | null;
  rejected: boolean;
  pdfUrl?: string;
  revisions?: Revision[];
}

interface PromptIdea {
  id: string;
  animal: string;
  action: string;
  scene: string;
  props: string;
  used: boolean;
  createdAt: string;
}

export default function AdminPage() {
  const [pages, setPages] = useState<GeneratedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pages' | 'ideas' | 'guidelines'>('pages');

  const apiKey = typeof window !== 'undefined'
    ? localStorage.getItem('admin_api_key') || ''
    : '';

  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/pages?api_key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) throw new Error('Failed to fetch pages');
      const data = await res.json();
      setPages(data.pages || []);
    } catch (err) {
      setError('Failed to load pages');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'GENERATE_API_KEY': apiKey,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Generation failed');
      }

      const data = await res.json();
      setSuccess(`Page generated successfully! (${data.cost})`);
      fetchPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (id: string, approved: boolean, rejectionFeedback?: string) => {
    try {
      const res = await fetch('/api/admin/pages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ id, approved, rejectionFeedback }),
      });

      if (!res.ok) throw new Error('Failed to update');

      setPages(pages.map(p =>
        p.id === id ? { ...p, approved, rejected: !approved } : p
      ));
      setSuccess(approved ? 'Page approved!' : rejectionFeedback ? 'Page rejected — feedback saved as guideline' : 'Page rejected');
    } catch {
      setError('Failed to update page');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this page?')) return;

    try {
      const res = await fetch(`/api/admin/pages?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!res.ok) throw new Error('Failed to delete');

      setPages(pages.filter(p => p.id !== id));
      setSuccess('Page deleted');
    } catch {
      setError('Failed to delete page');
    }
  };

  const handleRegenerate = async (pageId: string, reviewComment: string) => {
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/admin/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ pageId, reviewComment }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Regeneration failed');
      }

      const data = await res.json();
      setSuccess(`Generated ${data.generated} revision(s). Review them below.`);
      fetchPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed');
    }
  };

  const handleChooseRevision = async (pageId: string, revisionId: string) => {
    try {
      const res = await fetch('/api/admin/pages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ id: pageId, chooseRevisionId: revisionId }),
      });

      if (!res.ok) throw new Error('Failed to choose revision');

      setSuccess('Revision applied! The page image has been updated.');
      fetchPages();
    } catch {
      setError('Failed to apply revision');
    }
  };

  const pendingPages = pages.filter(p => p.approved === null && !p.rejected);
  const approvedPages = pages.filter(p => p.approved === true);
  const rejectedPages = pages.filter(p => p.rejected);

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Admin Setup</h1>
          <p className="text-gray-600 mb-4">
            Enter your API key to access the admin panel. This should match the
            GENERATE_API_KEY in your environment variables.
          </p>
          <input
            type="password"
            placeholder="Enter API Key"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            onChange={(e) => {
              localStorage.setItem('admin_api_key', e.target.value);
              window.location.reload();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Daily Doodle Admin</h1>
            <p className="text-gray-500 mt-1">Manage generated coloring pages</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="mt-4 sm:mt-0 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Generate New Page
              </>
            )}
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('pages')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pages'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Coloring Pages
          </button>
          <button
            onClick={() => setActiveTab('ideas')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'ideas'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Prompt Ideas Bank
          </button>
          <button
            onClick={() => setActiveTab('guidelines')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'guidelines'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Image Guidelines
          </button>
        </div>

        {activeTab === 'ideas' ? (
          <PromptIdeasPanel apiKey={apiKey} />
        ) : activeTab === 'guidelines' ? (
          <GuidelinesPanel apiKey={apiKey} />
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="text-2xl font-bold text-yellow-600">{pendingPages.length}</div>
                <div className="text-gray-500">Pending Review</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="text-2xl font-bold text-green-600">{approvedPages.length}</div>
                <div className="text-gray-500">Approved</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="text-2xl font-bold text-red-600">{rejectedPages.length}</div>
                <div className="text-gray-500">Rejected</div>
              </div>
            </div>

            {/* Loading */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-pulse text-gray-500">Loading...</div>
              </div>
            ) : pages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">&#x1f3a8;</div>
                <h2 className="text-xl font-semibold text-gray-700">No Pages Yet</h2>
                <p className="text-gray-500 mt-2">Click &quot;Generate New Page&quot; to create your first coloring page</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Pending */}
                {pendingPages.length > 0 && (
                  <section>
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Pending Review</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pendingPages.map((page) => (
                        <PageCard
                          key={page.id}
                          page={page}
                          onApprove={() => handleApprove(page.id, true)}
                          onReject={(feedback) => handleApprove(page.id, false, feedback)}
                          onDelete={() => handleDelete(page.id)}
                          onRegenerate={(comment) => handleRegenerate(page.id, comment)}
                          onChooseRevision={(revId) => handleChooseRevision(page.id, revId)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Approved */}
                {approvedPages.length > 0 && (
                  <section>
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Approved Pages</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {approvedPages.map((page) => (
                        <PageCard
                          key={page.id}
                          page={page}
                          onApprove={() => handleApprove(page.id, true)}
                          onReject={(feedback) => handleApprove(page.id, false, feedback)}
                          onDelete={() => handleDelete(page.id)}
                          onRegenerate={(comment) => handleRegenerate(page.id, comment)}
                          onChooseRevision={(revId) => handleChooseRevision(page.id, revId)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Rejected */}
                {rejectedPages.length > 0 && (
                  <section>
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Rejected</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {rejectedPages.map((page) => (
                        <PageCard
                          key={page.id}
                          page={page}
                          onApprove={() => handleApprove(page.id, true)}
                          onReject={(feedback) => handleApprove(page.id, false, feedback)}
                          onDelete={() => handleDelete(page.id)}
                          onRegenerate={(comment) => handleRegenerate(page.id, comment)}
                          onChooseRevision={(revId) => handleChooseRevision(page.id, revId)}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PageCard({
  page,
  onApprove,
  onReject,
  onDelete,
  onRegenerate,
  onChooseRevision,
}: {
  page: GeneratedPage;
  onApprove: () => void;
  onReject: (feedback?: string) => void;
  onDelete: () => void;
  onRegenerate: (comment: string) => void;
  onChooseRevision: (revisionId: string) => void;
}) {
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionFeedback, setRejectionFeedback] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const status = page.approved === null ? 'pending' : page.approved ? 'approved' : 'rejected';
  const hasRevisions = page.revisions && page.revisions.length > 0;

  const handleSubmitRevision = async () => {
    if (!reviewComment.trim()) return;
    setRegenerating(true);
    await onRegenerate(reviewComment);
    setRegenerating(false);
    setReviewComment('');
    setShowRevisionForm(false);
    setShowRevisions(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="aspect-square bg-gray-50 relative">
        {page.imageUrl ? (
          <img
            src={page.imageUrl}
            alt={page.prompt}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            &#x1f3a8;
          </div>
        )}
        <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${
          status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          status === 'approved' ? 'bg-green-100 text-green-800' :
          'bg-red-100 text-red-800'
        }`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
      </div>
      <div className="p-4">
        <p
          className={`text-sm text-gray-600 mb-2 ${promptExpanded ? '' : 'line-clamp-2'} cursor-pointer`}
          onClick={() => setPromptExpanded(!promptExpanded)}
        >
          {page.prompt}
        </p>
        <p className="text-xs text-gray-400 mb-4">
          {new Date(page.createdAt).toLocaleString()}
        </p>

        {/* Action buttons */}
        <div className="flex gap-2 mb-2">
          {page.approved === null && (
            <>
              <button
                onClick={onApprove}
                className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                Approve
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
              >
                Reject
              </button>
            </>
          )}
          {page.approved === true && (
            <button
              onClick={onDelete}
              className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
            >
              Delete
            </button>
          )}
          {page.rejected && (
            <button
              onClick={onDelete}
              className="flex-1 px-3 py-2 bg-red-100 text-red-700 text-sm rounded-lg hover:bg-red-200"
            >
              Remove
            </button>
          )}
        </div>

        {/* Rejection feedback form */}
        {showRejectForm && (
          <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
            <p className="text-xs font-medium text-red-800">
              Why are you rejecting this? (optional — helps improve future generations)
            </p>
            <textarea
              value={rejectionFeedback}
              onChange={(e) => setRejectionFeedback(e.target.value)}
              placeholder="e.g., 'Image contains text/lettering on signs', 'Lines are too thin', 'Too much shading'"
              className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm resize-none"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setRejecting(true);
                  await onReject(rejectionFeedback.trim() || undefined);
                  setRejecting(false);
                  setShowRejectForm(false);
                  setRejectionFeedback('');
                }}
                disabled={rejecting}
                className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {rejecting ? 'Rejecting...' : rejectionFeedback.trim() ? 'Reject with Feedback' : 'Reject without Feedback'}
              </button>
              <button
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectionFeedback('');
                }}
                className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Request Revision button */}
        <button
          onClick={() => setShowRevisionForm(!showRevisionForm)}
          className="w-full px-3 py-2 bg-amber-100 text-amber-800 text-sm rounded-lg hover:bg-amber-200 mb-2"
        >
          {showRevisionForm ? 'Cancel Revision' : 'Request Revision'}
        </button>

        {/* Revision form */}
        {showRevisionForm && (
          <div className="mt-2 space-y-2">
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Describe what to change (e.g., 'Make the lines thicker', 'Add more background detail', 'The bear should be smiling more')"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              rows={3}
            />
            <button
              onClick={handleSubmitRevision}
              disabled={regenerating || !reviewComment.trim()}
              className="w-full px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {regenerating ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating 3 revisions...
                </>
              ) : (
                'Generate 3 Revisions'
              )}
            </button>
          </div>
        )}

        {/* Show revisions toggle */}
        {hasRevisions && (
          <>
            <button
              onClick={() => setShowRevisions(!showRevisions)}
              className="w-full px-3 py-1 text-xs text-purple-600 hover:text-purple-800"
            >
              {showRevisions ? 'Hide' : 'Show'} {page.revisions!.length} revision(s)
            </button>

            {showRevisions && (
              <div className="mt-2 space-y-3">
                <p className="text-xs text-gray-500 italic">
                  &quot;{page.revisions![0]!.reviewComment}&quot;
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {page.revisions!.map((rev) => (
                    <div key={rev.id} className="relative">
                      <img
                        src={rev.imageUrl}
                        alt={`Revision ${rev.attempt}`}
                        className={`w-full aspect-square object-contain rounded border-2 cursor-pointer ${
                          rev.chosen ? 'border-green-500' : 'border-gray-200 hover:border-purple-400'
                        }`}
                        onClick={() => onChooseRevision(rev.id)}
                      />
                      <div className="text-center mt-1">
                        {rev.chosen ? (
                          <span className="text-xs text-green-600 font-medium">Chosen</span>
                        ) : (
                          <button
                            onClick={() => onChooseRevision(rev.id)}
                            className="text-xs text-purple-600 hover:text-purple-800"
                          >
                            Use this
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PromptIdeasPanel({ apiKey }: { apiKey: string }) {
  const [ideas, setIdeas] = useState<PromptIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [animal, setAnimal] = useState('');
  const [action, setAction] = useState('');
  const [scene, setScene] = useState('');
  const [props, setProps] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIdeas = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/prompt-ideas?api_key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setIdeas(data.ideas || []);
    } catch {
      setError('Failed to load prompt ideas');
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  const handleAdd = async () => {
    if (!animal.trim() || !action.trim() || !scene.trim() || !props.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/prompt-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ animal, action, scene, props }),
      });

      if (!res.ok) throw new Error('Failed to add');

      setAnimal('');
      setAction('');
      setScene('');
      setProps('');
      fetchIdeas();
    } catch {
      setError('Failed to add idea');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/admin/prompt-ideas?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      setIdeas(ideas.filter(i => i.id !== id));
    } catch {
      setError('Failed to delete idea');
    }
  };

  const unusedCount = ideas.filter(i => !i.used).length;
  const usedCount = ideas.filter(i => i.used).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="text-2xl font-bold text-blue-600">{unusedCount}</div>
          <div className="text-gray-500">Unused Ideas</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="text-2xl font-bold text-gray-400">{usedCount}</div>
          <div className="text-gray-500">Already Used</div>
        </div>
      </div>

      {/* Add new idea form */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Add New Prompt Idea</h3>
        <p className="text-sm text-gray-500 mb-4">
          These ideas will be used by the nightly cron job to generate coloring pages.
          Unused ideas are picked first (oldest first), then the system falls back to built-in prompts.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Animal</label>
            <input
              value={animal}
              onChange={(e) => setAnimal(e.target.value)}
              placeholder="e.g., bunny, penguin, fox"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="e.g., reading a book, baking cookies"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Scene</label>
            <input
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              placeholder="e.g., cozy library, sunny beach"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Props</label>
            <input
              value={props}
              onChange={(e) => setProps(e.target.value)}
              placeholder="e.g., stacked books, a lamp, and a blanket"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-600">{error}</div>
        )}

        <button
          onClick={handleAdd}
          disabled={submitting || !animal.trim() || !action.trim() || !scene.trim() || !props.trim()}
          className="mt-4 px-6 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Adding...' : 'Add Idea'}
        </button>
      </div>

      {/* Ideas list */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">All Ideas</h3>
        {loading ? (
          <div className="animate-pulse text-gray-500">Loading...</div>
        ) : ideas.length === 0 ? (
          <p className="text-gray-500 text-sm">No ideas yet. Add some above!</p>
        ) : (
          <div className="space-y-3">
            {ideas.map((idea) => (
              <div
                key={idea.id}
                className={`flex items-start justify-between p-3 rounded-lg border ${
                  idea.used ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      idea.used ? 'bg-gray-200 text-gray-600' : 'bg-blue-200 text-blue-700'
                    }`}>
                      {idea.used ? 'Used' : 'Unused'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">
                    A kawaii, chubby <strong>{idea.animal}</strong> {idea.action} in a cozy {idea.scene}.
                    Props: {idea.props}.
                    <span className="text-gray-400 italic"> (Template selected randomly at generation time)</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Added {new Date(idea.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(idea.id)}
                  className="ml-3 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface Guideline {
  id: string;
  guideline: string;
  occurrences: number;
  createdAt: string;
  updatedAt: string;
}

function GuidelinesPanel({ apiKey }: { apiKey: string }) {
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGuidelines = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/guidelines?api_key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setGuidelines(data.guidelines || []);
    } catch {
      setError('Failed to load guidelines');
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchGuidelines();
  }, [fetchGuidelines]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/admin/guidelines?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      setGuidelines(guidelines.filter(g => g.id !== id));
    } catch {
      setError('Failed to delete guideline');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Learned Image Guidelines</h3>
        <p className="text-sm text-gray-500 mb-4">
          These guidelines are automatically created from your rejection feedback and appended to every image generation prompt.
          The system deduplicates similar feedback — the &quot;occurrences&quot; count shows how many times similar feedback was given.
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-600">{error}</div>
        )}

        {loading ? (
          <div className="animate-pulse text-gray-500">Loading...</div>
        ) : guidelines.length === 0 ? (
          <p className="text-gray-500 text-sm">No guidelines yet. Reject images with feedback to build guidelines automatically.</p>
        ) : (
          <div className="space-y-3">
            {guidelines.map((g) => (
              <div
                key={g.id}
                className="flex items-start justify-between p-3 rounded-lg border bg-orange-50 border-orange-200"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-200 text-orange-800">
                      {g.occurrences}x reported
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{g.guideline}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Last updated {new Date(g.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(g.id)}
                  className="ml-3 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
