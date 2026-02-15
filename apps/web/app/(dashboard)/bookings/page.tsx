'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { SlideOver } from '@/components/ui/slide-over';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input, Select, Textarea } from '@/components/ui/form-fields';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import {
  getBookingEvents, createBookingEvent, updateBookingEvent, deleteBookingEvent,
  getBookingSlots, createBookingSlots, deleteBookingSlots, getPackages, getCurrentPhotographer,
} from '@/lib/queries';
import {
  CalendarCheck, Plus, Trash2, Copy, ExternalLink, Globe, Lock,
  Clock, MapPin, ChevronRight, Calendar as CalendarIcon, X, Loader2,
} from 'lucide-react';
import type { BookingEvent, BookingSlot, Package } from '@/lib/types';

interface SlotGeneration {
  date: string;
  startTime: string;
  endTime: string;
}

export default function BookingsPage() {
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [photographerId, setPhotographerId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', description: '', location: '', package_id: '',
    custom_price: '', slot_duration_minutes: '15', buffer_minutes: '0',
  });

  const [selectedEvent, setSelectedEvent] = useState<BookingEvent | null>(null);
  const [eventSlots, setEventSlots] = useState<BookingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [showSlotModal, setShowSlotModal] = useState(false);
  const [slotDates, setSlotDates] = useState<SlotGeneration[]>([{ date: '', startTime: '09:00', endTime: '17:00' }]);
  const [generatingSlots, setGeneratingSlots] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BookingEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [photographer, eventsData, pkgsData] = await Promise.all([
      getCurrentPhotographer(), getBookingEvents(), getPackages(true),
    ]);
    if (photographer) setPhotographerId(photographer.id);
    setEvents(eventsData);
    setPackages(pkgsData);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!photographerId) return;
    setSaving(true);
    const event = await createBookingEvent({
      title: createForm.title,
      description: createForm.description || undefined,
      location: createForm.location || undefined,
      package_id: createForm.package_id || undefined,
      custom_price: createForm.custom_price ? parseFloat(createForm.custom_price) : undefined,
      slot_duration_minutes: parseInt(createForm.slot_duration_minutes) || 15,
      buffer_minutes: parseInt(createForm.buffer_minutes) || 0,
    });
    if (event) {
      setEvents((prev) => [event, ...prev]);
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', location: '', package_id: '', custom_price: '', slot_duration_minutes: '15', buffer_minutes: '0' });
      openEventDetail(event);
    }
    setSaving(false);
  }

  async function openEventDetail(event: BookingEvent) {
    setSelectedEvent(event);
    setLoadingSlots(true);
    const slots = await getBookingSlots(event.id);
    setEventSlots(slots);
    setLoadingSlots(false);
  }

  async function handlePublishToggle() {
    if (!selectedEvent) return;
    const newStatus = selectedEvent.status === 'published' ? 'draft' : 'published';
    const updated = await updateBookingEvent(selectedEvent.id, { status: newStatus, is_published: newStatus === 'published' } as any);
    if (updated) {
      setSelectedEvent(updated);
      setEvents((prev) => prev.map((e) => e.id === updated.id ? updated : e));
    }
  }

  async function handleCloseEvent() {
    if (!selectedEvent) return;
    const updated = await updateBookingEvent(selectedEvent.id, { status: 'closed', is_published: false } as any);
    if (updated) {
      setSelectedEvent(updated);
      setEvents((prev) => prev.map((e) => e.id === updated.id ? updated : e));
    }
  }

  function generateTimeSlots(startTime: string, endTime: string, durationMin: number, bufferMin: number) {
    const slots: { start: string; end: string }[] = [];
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const endMinutes = eh * 60 + em;
    let cur = sh * 60 + sm;
    while (cur + durationMin <= endMinutes) {
      const se = cur + durationMin;
      slots.push({
        start: `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`,
        end: `${String(Math.floor(se / 60)).padStart(2, '0')}:${String(se % 60).padStart(2, '0')}`,
      });
      cur = se + bufferMin;
    }
    return slots;
  }

  async function handleGenerateSlots(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEvent) return;
    setGeneratingSlots(true);
    const allSlots: { event_id: string; date: string; start_time: string; end_time: string }[] = [];
    for (const dc of slotDates) {
      if (!dc.date) continue;
      const ts = generateTimeSlots(dc.startTime, dc.endTime, selectedEvent.slot_duration_minutes, selectedEvent.buffer_minutes);
      for (const t of ts) {
        allSlots.push({ event_id: selectedEvent.id, date: dc.date, start_time: t.start, end_time: t.end });
      }
    }
    if (allSlots.length > 0) {
      const created = await createBookingSlots(allSlots);
      setEventSlots((prev) => [...prev, ...created]);
    }
    setShowSlotModal(false);
    setSlotDates([{ date: '', startTime: '09:00', endTime: '17:00' }]);
    setGeneratingSlots(false);
  }

  async function handleDeleteEvent() {
    if (!deleteTarget) return;
    setDeleting(true);
    const success = await deleteBookingEvent(deleteTarget.id);
    if (success) {
      setEvents((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      if (selectedEvent?.id === deleteTarget.id) setSelectedEvent(null);
    }
    setDeleting(false);
    setDeleteTarget(null);
  }

  async function handleClearSlots() {
    if (!selectedEvent) return;
    await deleteBookingSlots(selectedEvent.id);
    setEventSlots([]);
  }

  function copyBookingLink(event: BookingEvent) {
    const url = `${window.location.origin}/book/${event.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(event.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function groupSlotsByDate(slots: BookingSlot[]): Record<string, BookingSlot[]> {
    return slots.reduce((acc, slot) => {
      if (!acc[slot.date]) acc[slot.date] = [];
      acc[slot.date].push(slot);
      return acc;
    }, {} as Record<string, BookingSlot[]>);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  const slotsByDate = groupSlotsByDate(eventSlots);
  const sortedDates = Object.keys(slotsByDate).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Booking Events</h1>
          <p className="text-sm text-slate-500 mt-1">Create bookable sessions for clients — mini shoots, events, availability</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" />New Event
        </Button>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No booking events yet"
          description="Create your first booking event — like Christmas Mini Sessions — and share the link with clients to let them book a time slot."
          action={{ label: "Create Booking Event", onClick: () => setShowCreateModal(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map((event) => {
            const pkg = packages.find((p) => p.id === event.package_id);
            const price = event.custom_price ?? (pkg ? Number(pkg.price) : undefined);
            return (
              <button
                key={event.id}
                onClick={() => openEventDetail(event)}
                className="text-left p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">{event.title}</h3>
                  <StatusBadge status={event.status} />
                </div>
                {event.description && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{event.description}</p>}
                <div className="space-y-1.5 text-xs text-slate-400">
                  {event.location && (
                    <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-slate-600" /><span>{event.location}</span></div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-600" />
                    <span>{event.slot_duration_minutes} min sessions</span>
                    {event.buffer_minutes > 0 && <span className="text-slate-600">({event.buffer_minutes}min buffer)</span>}
                  </div>
                  {price !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-400 font-semibold">{formatCurrency(price)}</span>
                      {pkg && <span className="text-slate-600">— {pkg.name}</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                  <span className="text-[10px] text-slate-600">{formatDate(event.created_at, 'short')}</span>
                  <div className="flex items-center gap-2">
                    {event.status === 'published' && (
                      <span onClick={(e) => { e.stopPropagation(); copyBookingLink(event); }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer">
                        {copiedId === event.id ? 'Copied!' : <><Copy className="w-3 h-3" />Link</>}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create Event Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Booking Event">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Event Title" placeholder="e.g. Christmas Mini Sessions 2026"
            value={createForm.title} onChange={(e: any) => setCreateForm((f) => ({ ...f, title: e.target.value }))} required />
          <Textarea label="Description" placeholder="What clients will see on the booking page..."
            value={createForm.description} onChange={(e: any) => setCreateForm((f) => ({ ...f, description: e.target.value }))} />
          <Input label="Location" placeholder="e.g. Botanic Gardens, Brisbane"
            value={createForm.location} onChange={(e: any) => setCreateForm((f) => ({ ...f, location: e.target.value }))} />
          <Select label="Package" value={createForm.package_id}
            options={[{ value: '', label: 'No package (custom price)' }, ...packages.map((p) => ({ value: p.id, label: `${p.name} — ${formatCurrency(Number(p.price))}` }))]}
            onChange={(e: any) => setCreateForm((f) => ({ ...f, package_id: e.target.value }))} />
          {!createForm.package_id && (
            <Input label="Custom Price" type="number" step="0.01" placeholder="0.00"
              value={createForm.custom_price} onChange={(e: any) => setCreateForm((f) => ({ ...f, custom_price: e.target.value }))} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Slot Duration (min)" type="number" value={createForm.slot_duration_minutes}
              onChange={(e: any) => setCreateForm((f) => ({ ...f, slot_duration_minutes: e.target.value }))} />
            <Input label="Buffer Between (min)" type="number" value={createForm.buffer_minutes}
              onChange={(e: any) => setCreateForm((f) => ({ ...f, buffer_minutes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !createForm.title}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Create Event
            </Button>
          </div>
        </form>
      </Modal>

      {/* Event Detail SlideOver */}
      <SlideOver open={!!selectedEvent} onClose={() => { setSelectedEvent(null); setEventSlots([]); }} title={selectedEvent?.title || ''}>
        {selectedEvent && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              {selectedEvent.status === 'draft' && (
                <Button size="sm" onClick={handlePublishToggle}><Globe className="w-3 h-3" />Publish</Button>
              )}
              {selectedEvent.status === 'published' && (
                <>
                  <Button size="sm" variant="secondary" onClick={handlePublishToggle}><Lock className="w-3 h-3" />Unpublish</Button>
                  <Button size="sm" variant="secondary" onClick={() => copyBookingLink(selectedEvent)}>
                    <Copy className="w-3 h-3" />{copiedId === selectedEvent.id ? 'Copied!' : 'Copy Link'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => window.open(`/book/${selectedEvent.slug}`, '_blank')}>
                    <ExternalLink className="w-3 h-3" />Preview
                  </Button>
                </>
              )}
              {selectedEvent.status !== 'closed' && (
                <Button size="sm" variant="danger" onClick={handleCloseEvent}><X className="w-3 h-3" />Close Event</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(selectedEvent)} className="ml-auto text-slate-600 hover:text-red-400">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Status</p>
              <StatusBadge status={selectedEvent.status} />
            </div>

            <div className="space-y-3">
              {selectedEvent.description && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Description</p>
                  <p className="text-sm text-slate-400">{selectedEvent.description}</p>
                </div>
              )}
              {selectedEvent.location && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Location</p>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <MapPin className="w-4 h-4 text-slate-500" /><span>{selectedEvent.location}</span>
                  </div>
                </div>
              )}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Session Details</p>
                <div className="flex items-center gap-4 text-sm text-slate-300">
                  <span><Clock className="w-3.5 h-3.5 inline mr-1 text-slate-500" />{selectedEvent.slot_duration_minutes} min</span>
                  {selectedEvent.buffer_minutes > 0 && <span className="text-slate-500">{selectedEvent.buffer_minutes}min buffer</span>}
                </div>
              </div>
            </div>

            {/* Slots Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Time Slots ({eventSlots.length} total · {eventSlots.filter((s) => s.status === 'booked').length} booked)
                </p>
                <div className="flex gap-2">
                  {eventSlots.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={handleClearSlots} className="text-xs text-red-400 hover:text-red-300">Clear All</Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setShowSlotModal(true)}><Plus className="w-3 h-3" />Add Slots</Button>
                </div>
              </div>

              {loadingSlots ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
              ) : eventSlots.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-white/[0.06] rounded-lg">
                  <CalendarIcon className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No time slots yet</p>
                  <p className="text-xs text-slate-600 mt-1">Add dates and times for clients to book</p>
                  <Button size="sm" variant="secondary" className="mt-3" onClick={() => setShowSlotModal(true)}>
                    <Plus className="w-3 h-3" />Generate Slots
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedDates.map((date) => {
                    const daySlots = slotsByDate[date];
                    const booked = daySlots.filter((s) => s.status === 'booked').length;
                    const available = daySlots.filter((s) => s.status === 'available').length;
                    return (
                      <div key={date}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-slate-300">
                            {new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </p>
                          <p className="text-[10px] text-slate-600">{available} available · {booked} booked</p>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                          {daySlots.map((slot) => (
                            <div key={slot.id} className={cn(
                              'px-2 py-1.5 rounded-md text-xs font-medium text-center border',
                              slot.status === 'available' && 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
                              slot.status === 'booked' && 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300',
                              slot.status === 'blocked' && 'bg-slate-500/10 border-slate-500/20 text-slate-500',
                              slot.status === 'canceled' && 'bg-red-500/10 border-red-500/20 text-red-400/50 line-through',
                            )}>
                              <span>{slot.start_time.slice(0, 5)}</span>
                              {slot.status === 'booked' && slot.booked_name && (
                                <p className="text-[10px] text-slate-500 truncate mt-0.5">{slot.booked_name}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </SlideOver>

      {/* Generate Slots Modal */}
      <Modal open={showSlotModal} onClose={() => setShowSlotModal(false)} title="Generate Time Slots">
        <form onSubmit={handleGenerateSlots} className="space-y-4">
          <p className="text-xs text-slate-500">
            Add dates and time ranges. Slots of {selectedEvent?.slot_duration_minutes || 15} minutes
            {selectedEvent?.buffer_minutes ? ` with ${selectedEvent.buffer_minutes}min buffer` : ''} will be auto-generated.
          </p>
          {slotDates.map((sd, i) => (
            <div key={i} className="flex items-end gap-2">
              <Input label={i === 0 ? 'Date' : ''} type="date" value={sd.date} required
                onChange={(e: any) => { const u = [...slotDates]; u[i] = { ...u[i], date: e.target.value }; setSlotDates(u); }} />
              <Input label={i === 0 ? 'Start' : ''} type="time" value={sd.startTime}
                onChange={(e: any) => { const u = [...slotDates]; u[i] = { ...u[i], startTime: e.target.value }; setSlotDates(u); }} />
              <Input label={i === 0 ? 'End' : ''} type="time" value={sd.endTime}
                onChange={(e: any) => { const u = [...slotDates]; u[i] = { ...u[i], endTime: e.target.value }; setSlotDates(u); }} />
              {slotDates.length > 1 && (
                <Button type="button" size="sm" variant="ghost" className="text-red-400 hover:text-red-300 mb-0.5"
                  onClick={() => setSlotDates((p) => p.filter((_, j) => j !== i))}><X className="w-3 h-3" /></Button>
              )}
            </div>
          ))}
          <Button type="button" size="sm" variant="secondary"
            onClick={() => setSlotDates((p) => [...p, { date: '', startTime: '09:00', endTime: '17:00' }])}>
            <Plus className="w-3 h-3" />Add Another Day
          </Button>

          {slotDates[0]?.date && selectedEvent && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 mb-2">Preview</p>
              {slotDates.filter((d) => d.date).map((d, i) => {
                const count = generateTimeSlots(d.startTime, d.endTime, selectedEvent.slot_duration_minutes, selectedEvent.buffer_minutes).length;
                return (
                  <p key={i} className="text-xs text-slate-400">
                    {new Date(d.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' '}&mdash; <span className="text-indigo-300 font-medium">{count} slots</span>
                    {' '}({d.startTime} – {d.endTime})
                  </p>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowSlotModal(false)}>Cancel</Button>
            <Button type="submit" disabled={generatingSlots || !slotDates.some((d) => d.date)}>
              {generatingSlots ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarIcon className="w-4 h-4" />}
              Generate Slots
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteEvent}
        title="Delete Booking Event"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? All time slots will also be deleted. This cannot be undone.`}
        confirmLabel="Delete Event"
        loading={deleting}
      />
    </div>
  );
}
