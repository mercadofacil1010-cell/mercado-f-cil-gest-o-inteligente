-- CHK-11 (B10.5) — Tela de alertas de validade 90/60/30 dias.
--
-- O dado já existia desde o B3.3 (view `expiring_lots`, RF-LOT-02/RN-CRT-VAL-03),
-- mas a view só trazia campos do lote, sem o mercado dono do endereço — a
-- tela precisa filtrar por mercado (como todo o resto do sistema), então a
-- view é recriada incluindo `market_id`/`company_id`. A segurança continua a
-- mesma: `security_invoker = true` já respeita a RLS de `public.lots`.

drop view public.expiring_lots;

create view public.expiring_lots
with (security_invoker = true) as
  select
    l.id as lot_id,
    l.warehouse_address_id,
    wa.market_id,
    m.company_id,
    l.product_id,
    l.batch_number,
    l.expires_at,
    l.status,
    coalesce(lb.balance, 0) as balance,
    (l.expires_at - current_date) as days_until_expiry
  from public.lots l
  join public.warehouse_addresses wa on wa.id = l.warehouse_address_id
  join public.markets m on m.id = wa.market_id
  left join public.lot_balances lb on lb.lot_id = l.id
  where l.expires_at is not null;
