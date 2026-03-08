'use client';

import { useState, useEffect, useCallback } from 'react';

interface GeneratedPage {
  id: string;
  prompt: string;
  imageUrl: string;
  fileKey: string;
  createdAt: string;
  approved: boolean | null;
  rejected: boolean;
  pdfUrl?: string;
}

export default function AdminPage() {
  const [pages, setPages] = useState<GeneratedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      const res = await fetch('/api/admin/pages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ id, approved }),
      });

      if (!res.ok) throw new Error('Failed to update');

      setPages(pages.map(p => 
        p.id === id ? { ...p, approved, rejected: !approved } : p
      ));
      setSuccess(approved ? 'Page approved!' : 'Page rejected');
    } catch (err) {
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
    } catch (err) {
      setError('Failed to delete page');
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
            <div className="text-6xl mb-4">🎨</div>
            <h2 className="text-xl font-semibold text-gray-700">No Pages Yet</h2>
            <p className="text-gray-500 mt-2">Click "Generate New Page" to create your first coloring page</p>
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
                      onReject={() => handleApprove(page.id, false)}
                      onDelete={() => handleDelete(page.id)}
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
                      onReject={() => handleApprove(page.id, false)}
                      onDelete={() => handleDelete(page.id)}
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
                      onReject={() => handleApprove(page.id, false)}
                      onDelete={() => handleDelete(page.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
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
}: {
  page: GeneratedPage;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const status = page.approved === null ? 'pending' : page.approved ? 'approved' : 'rejected';

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
            🎨
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
        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{page.prompt}</p>
        <p className="text-xs text-gray-400 mb-4">
          {new Date(page.createdAt).toLocaleString()}
        </p>
        <div className="flex gap-2">
          {page.approved === null && (
            <>
              <button
                onClick={onApprove}
                className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                Approve
              </button>
              <button
                onClick={onReject}
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
      </div>
    </div>
  );
}
