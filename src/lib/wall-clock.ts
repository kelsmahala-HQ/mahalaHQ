/**
 * calendar_events.start_at is entered as household-local wall-clock digits and stored the same
 * way (this app does no timezone conversion) -- Postgres round-trips it back UTC-tagged, but the
 * digits are still exactly what was typed. Formatting that value directly with date-fns/toLocale*
 * reads it through whatever timezone the server happens to be running in, shifting the displayed
 * time. This reconstructs a Date whose LOCAL getters match the original UTC digits, so normal
 * local-time formatting reproduces what was actually typed, regardless of server timezone.
 */
export function wallClockDate(isoString: string): Date {
  const d = new Date(isoString);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}
