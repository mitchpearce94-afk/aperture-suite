export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <svg width="64" height="64" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="9" width="34" height="26" rx="2" stroke="#d4a574" strokeWidth="0.5" opacity="0.15"/>
            <rect x="29" y="4.5" width="6" height="3.5" rx="0.8" stroke="#d4a574" strokeWidth="0.5" opacity="0.15"/>
            <path d="M22 3.5 L25.5 15.5 L22 13 Z" fill="#c47d4a" opacity="0.95"/>
            <path d="M38 11 L29 19 L28.5 14.5 Z" fill="#d4a574" opacity="0.7"/>
            <path d="M38 33 L28 25.5 L29.5 21 Z" fill="#c47d4a" opacity="0.55"/>
            <path d="M22 40.5 L18.5 28.5 L22 31 Z" fill="#d4a574" opacity="0.95"/>
            <path d="M6 33 L15 25.5 L15.5 30 Z" fill="#c47d4a" opacity="0.7"/>
            <path d="M6 11 L16 19 L14.5 23.5 Z" fill="#d4a574" opacity="0.55"/>
            <circle cx="22" cy="22" r="4" fill="#c47d4a"/>
          </svg>
        </div>
        <h1 className="text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Libre Baskerville', serif" }}>
          Apelier
        </h1>
        <p className="text-lg text-slate-400 mb-8">
          Shoot. Edit. Deliver.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-brand-500 text-white rounded-lg font-semibold hover:bg-brand-600 transition"
          >
            Get Started
          </a>
          <a
            href="/login"
            className="px-6 py-3 border border-slate-700 text-slate-300 rounded-lg font-semibold hover:border-slate-500 transition"
          >
            Sign In
          </a>
        </div>
      </div>
    </main>
  );
}
