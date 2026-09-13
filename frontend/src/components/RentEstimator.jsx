import { useState } from 'react';
import { estimateRent } from '../services/aiApi';

const SUBCITIES = [
  'Bole', 'Kirkos', 'Arada', 'Yeka', 'Nifas Silk-Lafto',
  'Gulele', 'Kolfe', 'Lidetta', 'Addis Ketema', 'Akaky Kaliti',
];

export default function RentEstimator() {
  const [form, setForm] = useState({
    subcity: 'Bole', bedrooms: 2, bathrooms: 1,
    area_sqm: 85, has_water_tank: false,
    has_generator: false, is_furnished: false,
  });
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await estimateRent({
        ...form,
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        area_sqm: Number(form.area_sqm),
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const confidencePct = result ? Math.round(result.confidence * 100) : 0;

  return (
    <div className="card">
      <h2 style={{ color: 'var(--text-heading)', marginBottom: 20 }}>
        🏠 Rent Estimator
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
        Get an XGBoost-powered market rent prediction for any Addis Ababa property.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Subcity</label>
          <select value={form.subcity} onChange={e => set('subcity', e.target.value)}>
            {SUBCITIES.map(s => <option key={s}>{s}</option>)}
          </select>
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
          <label>Floor Area (sqm)</label>
          <input type="number" min="10" max="5000" value={form.area_sqm}
            onChange={e => set('area_sqm', e.target.value)} />
        </div>

        <div className="form-row" style={{ marginBottom: 20 }}>
          {[
            ['has_water_tank', '💧 Water Tank'],
            ['has_generator', '⚡ Generator'],
            ['is_furnished',  '🛋️ Furnished'],
          ].map(([key, label]) => (
            <label key={key} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', textTransform: 'none', letterSpacing: 0,
              fontSize: 14, color: 'var(--text)',
            }}>
              <input type="checkbox" checked={form[key]}
                onChange={e => set(key, e.target.checked)}
                style={{ width: 'auto' }} />
              {label}
            </label>
          ))}
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? <><span className="spinner" /> Estimating...</> : '✨ Estimate Rent'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div style={{ marginTop: 28, padding: 24, background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div className="result-label">Estimated Monthly Rent</div>
              <div className="result-number">
                ETB {result.estimated_rent_etb.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="badge badge-primary">{result.model_used}</span>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                v{result.model_version}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Model Confidence</span>
              <span style={{ color: 'var(--text-heading)', fontWeight: 600 }}>{confidencePct}%</span>
            </div>
            <div className="confidence-bar-track">
              <div className="confidence-bar-fill" style={{ width: `${confidencePct}%` }} />
            </div>
          </div>

          <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text)' }}>Property:</strong>{' '}
            {result.input_summary?.bedrooms}BR / {result.input_summary?.bathrooms}BA,{' '}
            {result.input_summary?.area_sqm} sqm in {result.input_summary?.subcity?.replace(/\b\w/g, c => c.toUpperCase())}
          </div>
        </div>
      )}
    </div>
  );
}
