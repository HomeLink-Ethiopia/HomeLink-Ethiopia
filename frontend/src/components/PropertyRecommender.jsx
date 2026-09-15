import { useState } from 'react';
import { getRecommendations } from '../services/aiApi';

const ALL_SUBCITIES = [
  'Bole', 'Kirkos', 'Arada', 'Yeka', 'Nifas Silk-Lafto',
  'Gulele', 'Kolfe', 'Lidetta', 'Addis Ketema', 'Akaky Kaliti',
];

// Demo candidate properties shown by default
const DEMO_PROPERTIES = [
  { property_id: 'HM-001', price_etb: 42000, bedrooms: 2, bathrooms: 1, subcity: 'bole',        area_sqm: 90,  is_furnished: false },
  { property_id: 'HM-002', price_etb: 38000, bedrooms: 3, bathrooms: 2, subcity: 'kirkos',      area_sqm: 110, is_furnished: true  },
  { property_id: 'HM-003', price_etb: 55000, bedrooms: 2, bathrooms: 2, subcity: 'bole',        area_sqm: 95,  is_furnished: true  },
  { property_id: 'HM-004', price_etb: 28000, bedrooms: 1, bathrooms: 1, subcity: 'yeka',        area_sqm: 60,  is_furnished: false },
  { property_id: 'HM-005', price_etb: 44500, bedrooms: 2, bathrooms: 2, subcity: 'bole',        area_sqm: 100, is_furnished: false },
  { property_id: 'HM-006', price_etb: 32000, bedrooms: 2, bathrooms: 1, subcity: 'arada',       area_sqm: 75,  is_furnished: false },
  { property_id: 'HM-007', price_etb: 65000, bedrooms: 4, bathrooms: 3, subcity: 'kirkos',      area_sqm: 160, is_furnished: true  },
  { property_id: 'HM-008', price_etb: 22000, bedrooms: 1, bathrooms: 1, subcity: 'kolfe',       area_sqm: 50,  is_furnished: false },
];

function scoreColor(score) {
  if (score >= 80) return 'var(--success)';
  if (score >= 55) return 'var(--warning)';
  return 'var(--text-muted)';
}

export default function PropertyRecommender() {
  const [budget, setBudget]         = useState(45000);
  const [subcities, setSubcities]   = useState(['Bole', 'Kirkos']);
  const [minBeds, setMinBeds]       = useState(2);
  const [minBaths, setMinBaths]     = useState(1);
  const [furnished, setFurnished]   = useState(false);
  const [limit, setLimit]           = useState(5);

  const [results, setResults]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  function toggleSubcity(s) {
    setSubcities(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (subcities.length === 0) { setError('Select at least one preferred subcity.'); return; }
    setLoading(true); setError(null); setResults(null);
    try {
      const data = await getRecommendations({
        max_budget_etb:       Number(budget),
        preferred_subcities:  subcities,
        min_bedrooms:         Number(minBeds),
        min_bathrooms:        Number(minBaths),
        require_furnished:    furnished,
        limit:                Number(limit),
        candidate_properties: DEMO_PROPERTIES,
      });
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ color: 'var(--text-heading)', marginBottom: 8 }}>
        🏘️ Property Recommender
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
        Get AI-ranked property recommendations scored on budget fit, location, and amenities.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Max Monthly Budget (ETB)</label>
          <input type="number" min="1000" value={budget} onChange={e => setBudget(e.target.value)} />
        </div>

        <div className="form-group">
          <label>Preferred Subcities</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {ALL_SUBCITIES.map(s => (
              <button key={s} type="button"
                className={subcities.includes(s) ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ padding: '5px 14px', fontSize: 13 }}
                onClick={() => toggleSubcity(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Min Bedrooms</label>
            <input type="number" min="0" max="10" value={minBeds} onChange={e => setMinBeds(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Min Bathrooms</label>
            <input type="number" min="0" max="10" value={minBaths} onChange={e => setMinBaths(e.target.value)} />
          </div>
        </div>

        <div className="form-row" style={{ alignItems: 'center', marginBottom: 20 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', textTransform: 'none', letterSpacing: 0, fontSize: 14, color: 'var(--text)',
          }}>
            <input type="checkbox" checked={furnished} onChange={e => setFurnished(e.target.checked)}
              style={{ width: 'auto' }} />
            🛋️ Must be furnished
          </label>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Max Results</label>
            <input type="number" min="1" max="20" value={limit} onChange={e => setLimit(e.target.value)} />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? <><span className="spinner" /> Finding matches...</> : '🔍 Find Properties'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {results && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-heading)' }}>{results.recommendations?.length}</strong> matches
              from {results.total_candidates_evaluated} candidates
            </div>
            <span className="badge badge-primary">{results.model_version}</span>
          </div>

          {results.recommendations?.length === 0 && (
            <div className="alert alert-info">No properties matched your criteria. Try increasing your budget or adding more subcities.</div>
          )}

          {results.recommendations?.map((rec, i) => (
            <div key={rec.property_id} className="rec-card">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: 'var(--surface)', color: 'var(--text-muted)',
                  }}>#{i + 1}</span>
                  <strong style={{ color: 'var(--text-heading)', fontSize: 15 }}>{rec.property_id}</strong>
                </div>
                <ul className="rec-reasons">
                  {rec.match_reasons?.map((r, ri) => <li key={ri}>· {r}</li>)}
                </ul>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="rec-score" style={{ color: scoreColor(rec.match_score) }}>
                  {rec.match_score}<span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/100</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
