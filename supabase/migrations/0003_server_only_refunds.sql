-- ============================================================
-- Webuild pour Claude : remboursements réservés au serveur
-- À exécuter après 0002_credits_themes_billing.sql.
-- ============================================================
-- Jusqu'ici, tout membre pouvait appeler refund_credits sur n'importe quel débit de son agence,
-- y compris une livraison ou une image réussie : il récupérait ses crédits et tout devenait gratuit.
-- Seul le serveur sait qu'une opération a échoué : il rembourse avec la clé secrète (service_role).

create or replace function public.refund_credits(transaction_id uuid, details text default null)
returns public.credit_transactions
language plpgsql volatile security definer set search_path = ''
as $$
declare
  original public.credit_transactions;
  tx public.credit_transactions;
begin
  select * into original from public.credit_transactions t where t.id = transaction_id;
  if original.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if original.amount >= 0 then
    raise exception 'not_refundable' using errcode = '22023';
  end if;

  -- Pas de auth.uid() ici (appel serveur) : le remboursement est attribué à l'auteur du débit.
  insert into public.credit_transactions
    (organization_id, amount, reason, description, reference_type, reference_id, idempotency_key, user_id)
  values (original.organization_id, -original.amount, 'refund', coalesce(details, 'Remboursement'),
    'credit_transaction', original.id::text, 'refund:' || original.id, original.user_id)
  on conflict (idempotency_key) do nothing
  returning * into tx;

  if tx.id is null then
    select * into tx from public.credit_transactions t where t.idempotency_key = 'refund:' || original.id;
  end if;
  return tx;
end;
$$;

revoke execute on function public.refund_credits(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_credits(uuid, text) to service_role;
