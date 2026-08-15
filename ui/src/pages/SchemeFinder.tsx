import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SchemeFinderComponent, { type VaultDocument } from '../components/schemes/SchemeFinder';
import { fetchVaultDocuments } from '../utils/vaultDocuments';

export default function SchemeFinder() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    fetchVaultDocuments()
      .then((docs) => {
        setDocuments(docs);
        setError(false);
      })
      .catch((err) => {
        console.error('Failed to load document readiness:', err);
        setError(true);
        setDocuments([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="relative">
      {loading && (
        <div className="pt-24 px-6 max-w-7xl mx-auto text-center text-sm text-slate-500">
          Loading document readiness...
        </div>
      )}

      {error && !loading && (
        <div className="pt-20 px-6 max-w-7xl mx-auto">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
            Document readiness could not be loaded. Preliminary scheme guidance is still available.
          </div>
        </div>
      )}

      <SchemeFinderComponent
        documents={documents}
        onReviewConflict={(schemeId, docKeys) => {
          const scheme = encodeURIComponent(schemeId);
          const docs = encodeURIComponent(docKeys.join(','));

          navigate(`/report?scheme=${scheme}&docs=${docs}`);
        }}
      />
    </div>
  );
}