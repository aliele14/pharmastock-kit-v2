import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'PharmaStock — Supply Chain Analytics';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  const features = ['FEFO Expiry Risk', 'Reorder Intelligence', 'Anomaly Detection', 'Supply Briefing'];

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0f172a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: 80,
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: 80,
            height: 80,
            background: '#0f766e',
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 36,
          }}
        >
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>

        {/* App name */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: '#e6e8eb',
            textAlign: 'center',
            lineHeight: 1.1,
          }}
        >
          PharmaStock
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: '#64748b',
            marginTop: 16,
            textAlign: 'center',
          }}
        >
          Supply Chain Analytics · Deterministic · Zero AI at runtime
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 20, marginTop: 56 }}>
          {features.map((feat) => (
            <div
              key={feat}
              style={{
                background: '#171a20',
                border: '1px solid #242830',
                borderRadius: 10,
                padding: '10px 20px',
                color: '#98a2b3',
                fontSize: 20,
              }}
            >
              {feat}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
