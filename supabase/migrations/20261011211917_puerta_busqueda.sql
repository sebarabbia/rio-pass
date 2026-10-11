-- =============================================================================
-- Rio Pass · 09 · Puerta: buscar invitados por nombre
-- =============================================================================
-- Para cuando el invitado no puede mostrar el QR (sin batería, sin señal): el
-- acreditador busca por nombre y le da ingreso con validate_access('manual', código).
-- Ignora mayúsculas y acentos ("martin" encuentra a "Martín").
-- =============================================================================

create function private.fold(_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(lower(coalesce(_text, '')), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc')
$$;

create function public.search_door_guests(_event_id uuid, _query text)
returns table (code text, holder text, sector text, status public.ticket_status, kind public.ticket_kind, used_at timestamptz, issuer text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- Se escapan los comodines de LIKE para que "%" o "_" se busquen literalmente.
  _q text := replace(replace(replace(private.fold(btrim(coalesce(_query, ''))), '\', '\\'), '%', '\%'), '_', '\_');
begin
  if not (private.has_role('acreditador') or private.has_role('organizador')) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if char_length(_q) < 2 then
    return;
  end if;
  return query
    select t.code, coalesce(t.holder_name, p.full_name), tt.name, t.status, t.kind, t.used_at,
           case when i.id is null then null else private.short_name(i.full_name) end
    from public.tickets t
    left join public.profiles p on p.id = t.user_id
    left join public.ticket_types tt on tt.id = t.ticket_type_id
    left join public.profiles i on i.id = t.issued_by
    where t.event_id = _event_id
      and private.fold(coalesce(t.holder_name, p.full_name)) like '%' || _q || '%'
    order by (t.status = 'valido') desc, coalesce(t.holder_name, p.full_name)
    limit 20;
end;
$$;
comment on function public.search_door_guests is 'Busca QR de un evento por nombre del titular. Solo acreditador u organizador.';

revoke execute on function private.fold(text) from public;
revoke execute on function public.search_door_guests(uuid, text) from public, anon;
grant execute on function public.search_door_guests(uuid, text) to authenticated;
