'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { formatCurrency, cn } from '@/lib/utils';
import { Calendar, Clock, MapPin, Check, Loader2, Camera } from 'lucide-react';

interface BookingEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  package_id?: string;
  custom_price?: number;
  slot_duration_minutes: number;
  accent_color?: string;
  require_phone: boolean;
  require_address: boolean;
  custom_questions: any[];
  photographer_id: string;
}

interface BookingSlot {
  id: string;
  event_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
}

interface Photographer {
  business_name?: string;
  name: string;
  brand_settings: any;
}

export default function PublicBookingPage() {
  const { slug } = useParams() as { slug: string };
  const [event, setEvent] = useState<BookingEvent | null>(null);
  const [photographer, setPhotographer] = useState<Photographer | null>(null);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packagePrice, setPackagePrice] = useState<number | null>(null);

  // Booking state
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [bookingForm, setBookingForm] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    async function load() {
      const sb = createSupabaseClient();

      // Fetch event by slug (anon access for published events)
      const { data: eventData, error: eventError } = await sb
        .from('booking_events')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .eq('is_published', true)
        .single();

      if (eventError || !eventData) {
        setError('This booking page is not available.');
        setLoading(false);
        return;
      }
      setEvent(eventData);

      // Fetch photographer branding
      const { data: pData } = await sb
        .from('photographers')
        .select('business_name, name, brand_settings')
        .eq('id', eventData.photographer_id)
        .single();
      if (pData) setPhotographer(pData);

      // Fetch package price if linked
      if (eventData.package_id) {
        const { data: pkgData } = await sb
          .from('packages')
          .select('price')
          .eq('id', eventData.package_id)
          .single();
        if (pkgData) setPackagePrice(Number(pkgData.price));
      }

      // Fetch available slots
      const { data: slotsData } = await sb
        .from('booking_slots')
        .select('*')
        .eq('event_id', eventData.id)
        .eq('status', 'available')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      setSlots(slotsData || []);
      setLoading(false);
    }
    load();
  }, [slug]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot || !event) return;
    setSubmitting(true);

    const sb = createSupabaseClient();

    // Book the slot (anon update policy allows available → booked)
    const { error: bookError } = await sb
      .from('booking_slots')
      .update({
        status: 'booked',
        booked_name: bookingForm.name,
        booked_email: bookingForm.email,
        booked_phone: bookingForm.phone || null,
        booked_at: new Date().toISOString(),
      })
      .eq('id', selectedSlot.id)
      .eq('status', 'available'); // Safety: only book if still available

    if (bookError) {
      alert('Sorry, this slot is no longer available. Please choose another time.');
      // Refresh slots
      const { data: freshSlots } = await sb
        .from('booking_slots')
        .select('*')
        .eq('event_id', event.id)
        .eq('status', 'available')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });
      setSlots(freshSlots || []);
      setSelectedSlot(null);
      setSubmitting(false);
      return;
    }

    // Remove booked slot from available list
    setSlots((prev) => prev.filter((s) => s.id !== selectedSlot.id));
    setBooked(true);
    setSubmitting(false);
  }

  const accentColor = event?.accent_color || photographer?.brand_settings?.primary_color || '#6366f1';
  const brandName = photographer?.business_name || photographer?.name || 'Studio';

  // Group available slots by date
  const slotsByDate = slots.reduce((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {} as Record<string, BookingSlot[]>);
  const sortedDates = Object.keys(slotsByDate).sort();
  const price = event?.custom_price ?? packagePrice;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center px-4">
        <div className="text-center">
          <Camera className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Not Available</h1>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (booked) {
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: accentColor + '20' }}>
            <Check className="w-8 h-8" style={{ color: accentColor }} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">You&apos;re Booked!</h1>
          <p className="text-sm text-slate-400 mb-4">
            Your session with {brandName} has been confirmed for{' '}
            <span className="text-white font-medium">
              {selectedSlot && new Date(selectedSlot.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' '}at {selectedSlot?.start_time.slice(0, 5)}
            </span>.
          </p>
          <p className="text-xs text-slate-600">You&apos;ll receive a confirmation email shortly with all the details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a14]">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 py-6 text-center">
        <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: accentColor }}>
          {brandName.charAt(0)}
        </div>
        <p className="text-xs text-slate-500 mb-1">{brandName}</p>
        <h1 className="text-2xl font-bold text-white">{event?.title}</h1>
        {event?.description && <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">{event.description}</p>}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-500">
          {event?.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{event?.slot_duration_minutes} min session</span>
          {price !== undefined && price !== null && <span className="text-emerald-400 font-semibold">{formatCurrency(price)}</span>}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {sortedDates.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-white mb-1">All slots are booked</h2>
            <p className="text-sm text-slate-500">Check back later for new availability.</p>
          </div>
        ) : !selectedSlot ? (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Choose a Time</h2>
            {sortedDates.map((date) => (
              <div key={date}>
                <p className="text-sm font-semibold text-slate-300 mb-3">
                  <Calendar className="w-3.5 h-3.5 inline mr-1.5 text-slate-500" />
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {slotsByDate[date].map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot)}
                      className="px-3 py-2.5 rounded-lg border border-white/[0.08] text-sm font-medium text-white hover:border-opacity-40 transition-all"
                      style={{ '--tw-border-opacity': 0.08 } as any}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = accentColor; (e.currentTarget as HTMLElement).style.backgroundColor = accentColor + '10'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
                    >
                      {slot.start_time.slice(0, 5)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <button onClick={() => setSelectedSlot(null)} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
              ← Back to times
            </button>
            <div className="rounded-xl border border-white/[0.06] p-4">
              <p className="text-xs text-slate-500 mb-1">Selected</p>
              <p className="text-white font-semibold">
                {new Date(selectedSlot.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })} at {selectedSlot.start_time.slice(0, 5)}
              </p>
            </div>
            <form onSubmit={handleBook} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Your Details</h2>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name *</label>
                <input type="text" required value={bookingForm.name}
                  onChange={(e) => setBookingForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email *</label>
                <input type="email" required value={bookingForm.email}
                  onChange={(e) => setBookingForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50" />
              </div>
              {event?.require_phone && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone *</label>
                  <input type="tel" required value={bookingForm.phone}
                    onChange={(e) => setBookingForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50" />
                </div>
              )}
              <button type="submit" disabled={submitting}
                className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: accentColor }}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirm Booking
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6 border-t border-white/[0.04]">
        <p className="text-[10px] text-slate-700">Powered by <span className="text-slate-600">Apelier</span></p>
      </div>
    </div>
  );
}
