import { useState, useEffect } from 'react';
import './index.css';
import RentEstimator      from './components/RentEstimator';
import FraudDetector      from './components/FraudDetector';
import PropertyRecommender from './components/PropertyRecommender';
import { checkAiHealth }  from './services/aiApi';

const TABS = [
  { id: 'rent',    label: '🏠 Rent Estimator'   },
  { id: 'fraud',   label: '🛡️ Fraud Detector'   },
  { id: 'recommend', label: '🏘️ Recommender'    },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('rent');
  const [aiOnline, setAiOnline]   = useState(null); // null = checking

  useEffect(() => {
    checkAiHealth().then(ok => setAiOnline(ok));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <header style={{
        padding: '18px 32px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 0 16px var(--primary-glow)',
          }}>🏡</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-heading)', lineHeight: 1.2 }}>
              HomeLink Ethiopia
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI Intelligence Dashboard</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: aiOnline === null ? 'var(--warning)' : aiOnline ? 'var(--success)' : 'var(--danger)',
            boxShadow: aiOnline ? '0 0 8px var(--success)' : 'none',
          }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {aiOnline === null ? 'Checking AI...' : aiOnline ? 'AI Online' : 'AI Offline'}
          </span>
        </div>
      </header>

      {/* ── AI offline warning ──────────────────────────────── */}
      {aiOnline === false && (
        <div className="alert alert-error" style={{ margin: '16px 32px', borderRadius: 'var(--radius)' }}>
          ⚠️ AI microservice is unreachable. Start it with:{' '}
          <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: 4 }}>
            cd ai &amp;&amp; uvicorn main:app --reload
          </code>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────── */}
      <main style={{ maxWidth: 760, margin: '32px auto', padding: '0 20px 60px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{
            fontSize: 40, fontWeight: 800, letterSpacing: -1.5,
            color: 'var(--text-heading)', marginBottom: 10, lineHeight: 1.1,
            background: 'linear-gradient(135deg, #f0f2ff 0%, var(--primary-light) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            AI-Powered Housing Intelligence
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>
            XGBoost rent predictions · IsolationForest fraud scoring · Weighted recommendations
          </p>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {TABS.map(t => (
            <button key={t.id} className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Active panel */}
        {activeTab === 'rent'      && <RentEstimator />}
        {activeTab === 'fraud'     && <FraudDetector />}
        {activeTab === 'recommend' && <PropertyRecommender />}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 48, fontSize: 12, color: 'var(--text-muted)' }}>
          HomeLink Ethiopia · AI Engine v1.1.0 · XGBoost · IsolationForest · Scikit-learn
        </div>
      </main>
    </div>
  );
}
