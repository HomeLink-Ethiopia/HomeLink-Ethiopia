import { useState } from 'react';
import { detectFraud } from '../services/aiApi';

const SUBCITIES = [
  'Bole', 'Kirkos', 'Arada', 'Yeka', 'Nifas Silk-Lafto',
  'Gulele', 'Kolfe', 'Lidetta', 'Addis Ketema', 'Akaky Kaliti',
];

function riskClass(level) {
  if (level === 'low')    return 'risk-low';
  if (level === 'medium') return 'risk-medium';
  return 'risk-high';
}
function riskBadgeClass(level) {
  if (level === 'low')    return 'badge-success';
  if (level === 'medium') return 'badge-warning';
  return 'badge-danger';
}

export default function FraudDetector() {
  const [form, setForm] = useState({
    listing_id: 'LISTING-001', price_etb: 15000,
    bedrooms: 2, bathrooms: 1, area_sqm: 80,
    subcity: 'Bole',
    description: '',
    contact_info: '',
  });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await detectFraud({
        ...form,
        price_etb: Number(form.price_etb),
        bedrooms:  Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        area_sqm:  Number(form.area_sqm),
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ color: 'var(--text-heading)', marginBottom: 8 }}>
        🛡️ Fraud Risk Detector
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
        Analyse a listing for price anomalies, suspicious text, and ML-detected outliers.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Listing ID</label>
            <input value={form.listing_id} onChange={e => set('listing_id', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Asking Price (ETB / mo)</label>
            <input type="number" min="0" value={form.price_etb}
              onChange={e => set('price_etb', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Subcity</label>
            <select value={form.subcity} onChange={e => set('subcity', e.target.value)}>
              {SUBCITIES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Floor Area (sqm)</label>
            <input type="number" min="10" value={form.area_sqm}
              onChange={e => set('area_sqm', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Bedrooms</label>
            <input type="number" min="0" max="20" value={form.bedrooms}
              onChange={e => set('bedrooms', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Bathrooms</label>
            <input type="number" min="0" max="20" value={form.bathrooms}
              onChange={e => set('bathrooms', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea rows={3} value={form.description} placeholder="Listing description text..."
            onChange={e => set('description', e.target.value)} />
        </div>

        <div className="form-group">
          <label>Contact Info</label>
          <input value={form.contact_info} placeholder="Phone number or email"
            onChange={e => set('contact_info', e.target.value)} />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? <><span className="spinner" /> Analysing...</> : '🔍 Analyse Listing'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div style={{ marginTop: 28 }}>
          {/* Risk summary header */}
          <div style={{
            display: 'flex', gap: 20, alignItems: 'center',
            padding: 20, background: 'var(--surface-2)',
            borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 16,
          }}>
            <div className={`risk-ring ${riskClass(result.risk_level)}`}>
              {result.risk_score}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span className="result-label">Risk Score</span>
                <span className={`badge ${riskBadgeClass(result.risk_level)}`}>
                  {result.risk_level?.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Price deviation: <strong style={{ color: 'var(--text)' }}>
                  {result.price_deviation_percent > 0 ? '+' : ''}{result.price_deviation_percent?.toFixed(1)}%
                </strong> vs market
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Confidence: {Math.round((result.confidence || 0) * 100)}% · {result.model_version}
              </div>
            </div>
          </div>

          {/* Signal breakdown */}
          {result.signal_breakdown && (
            <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 12 }}>
                Signal Breakdown
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
                {[
                  ['Price',   result.signal_breakdown.price_anomaly],
                  ['Text',    result.signal_breakdown.text_metadata],
                  ['ML',      result.signal_breakdown.ml_anomaly],
                ].map(([label, val]) => (
                  <div key={label} style={{ padding: 12, background: 'var(--surface)', borderRadius: 8 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-heading)' }}>
                      {(val || 0).toFixed(1)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Red flags */}
          {result.red_flags?.length > 0 && (
            <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--danger)', marginBottom: 12 }}>
                ⚠️ Red Flags ({result.red_flags.length})
              </div>
              <ul className="flag-list">
                {result.red_flags.map((flag, i) => (
                  <li key={i}>
                    <div className="flag-dot" />
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.red_flags?.length === 0 && (
            <div className="alert alert-success">✅ No red flags detected — listing appears legitimate.</div>
          )}
        </div>
      )}
    </div>
  );
}
