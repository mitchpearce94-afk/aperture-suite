'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Check, Loader2, AlertCircle, Camera } from 'lucide-react';

export default function QuoteAcceptPage() {
  const params = useParams();
  const token = params.token as string;
  const [status, setStatus] = useState<'loading' | 'confirming' | 'success' | 'already_booked' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [quoteInfo, setQuoteInfo] = useState<any>(null);

  useEffect(() => {
    // Fetch quote info for display
    async function loadQuote() {
      try {
        const res = await fetch(`/api/quote/info?token=${token}`);
        if (res.ok) {
          const data = await res.json();
          setQuoteInfo(data);
          setStatus('confirming');
        } else {
          const data = await res.json();
          if (data.already_booked) {
            setStatus('already_booked');
          } else {
            setStatus('error');
            setMessage(data.error || 'Quote not found.');
          }
        }
      } catch {
        setStatus('error');
        setMessage('Could not load quote details.');
      }
    }
    loadQuote();
  }, [token]);

  async function handleAccept() {
    setStatus('loading');
    try {
      const res = await fetch('/api/quote/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
      } else if (data.already_booked) {
        setStatus('already_booked');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong.');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a12] to-[#111118] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 mb-3">
            <Camera className="w-6 h-6 text-amber-400" />
          </div>
          {quoteInfo?.businessName && (
            <p className="text-sm text-slate-400">{quoteInfo.businessName}</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8">
          {status === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400">Loading...</p>
            </div>
          )}

          {status === 'confirming' && quoteInfo && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-xl font-bold text-white mb-1">Your Quote</h1>
                <p className="text-sm text-slate-400">Review and accept to confirm your booking</p>
              </div>

              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-400">Package</span>
                  <span className="text-sm text-white font-medium">{quoteInfo.packageName}</span>
                </div>
                {quoteInfo.amount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Total</span>
                    <span className="text-lg text-white font-bold">
                      {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(quoteInfo.amount)}
                    </span>
                  </div>
                )}
                {quoteInfo.includedImages && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Included Images</span>
                    <span className="text-sm text-white">{quoteInfo.includedImages}</span>
                  </div>
                )}
                {quoteInfo.preferredDate && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Date</span>
                    <span className="text-sm text-white">{new Date(quoteInfo.preferredDate).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                )}
                {quoteInfo.location && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Location</span>
                    <span className="text-sm text-white">{quoteInfo.location}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-500 text-center">
                By accepting, you'll receive a booking confirmation, invoice, and contract to sign.
              </p>

              <button
                onClick={handleAccept}
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-colors"
              >
                Accept Quote & Book
              </button>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white mb-1">Booking Confirmed!</h1>
                <p className="text-sm text-slate-400">
                  You'll receive a confirmation email, invoice, and contract to sign shortly.
                </p>
              </div>
            </div>
          )}

          {status === 'already_booked' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white mb-1">Already Booked</h1>
                <p className="text-sm text-slate-400">
                  This quote has already been accepted. Check your email for booking details.
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white mb-1">Something went wrong</h1>
                <p className="text-sm text-slate-400">{message}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
