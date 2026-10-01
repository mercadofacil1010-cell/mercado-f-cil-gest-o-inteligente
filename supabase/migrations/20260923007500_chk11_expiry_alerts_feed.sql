-- CHK-11 (B10.5) — Alertas de validade 90/60/30 dias dentro do motor de
-- alertas já existente (B6.2), em vez de uma tela nova e separada: o dado
-- (view `expiring_lots`, B3.3) já existia, só faltava um tipo de alerta que
-- o dono/gerente já conhece (mesma tela "Alertas", mesmo fluxo de
-- sincronizar/descartar). Dispara quando faltam 90 dias ou menos para o
-- vencimento (cobre 90/60/30 e também o lote já vencido) e ainda há saldo —
-- some sozinho quando o lote é esvaziado (saída ou perda) ou some o próprio
-- lote; descarte manual segue a mesma regra de RN-DSH-05.

alter table public.alerts add column lot_id uuid references public.lots (id);

alter type public.alert_type add value 'lote_vencendo';
