import { Camera } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative z-10 flex flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Aperture Suite</span>
          </div>
          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              From shutter click to client delivery in under 1 hour.
            </h1>
            <p className="text-lg text-white/70">
              CRM, AI editing, and client galleries — all in one platform built for photographers.
            </p>
          </div>
          <p className="text-sm text-white/40">
            &copy; 2026 Aperture Suite. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0a0a0f]">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
