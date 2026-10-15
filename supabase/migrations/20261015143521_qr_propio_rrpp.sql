-- Rio Pass · 10 · Nuevo tipo de QR: el propio del RRPP (intransferible).
-- Va en una migración aparte porque un valor nuevo de enum no se puede usar
-- en la misma transacción en que se crea.
alter type public.ticket_kind add value if not exists 'rrpp';
