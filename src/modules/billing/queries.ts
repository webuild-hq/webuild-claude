import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Plan = {
  id: string;
  name: string;
  monthlyCredits: number;
  maxMembers: number;
  priceCents: number;
  currency: string;
};

export type Subscription = {
  planId: string;
  status: string;
  stripeCustomerId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type CreditTransaction = {
  id: string;
  amount: number;
  reason: string;
  description: string | null;
  createdAt: string;
};

export type CreditPrice = { action: string; credits: number; label: string };

type PlanRow = {
  id: string;
  name: string;
  monthly_credits: number;
  max_members: number;
  price_cents: number;
  currency: string;
};

function toPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    monthlyCredits: row.monthly_credits,
    maxMembers: row.max_members,
    priceCents: row.price_cents,
    currency: row.currency,
  };
}

export async function listPlans(supabase: SupabaseClient): Promise<Plan[]> {
  const { data, error } = await supabase.from("plans").select("*").order("sort").returns<PlanRow[]>();
  if (error) throw error;
  return (data ?? []).map(toPlan);
}

export async function getOrganizationPlan(supabase: SupabaseClient, organizationId: string): Promise<Plan> {
  const { data, error } = await supabase.rpc("org_plan", { org: organizationId }).single<PlanRow>();
  if (error || !data) throw error ?? new Error("Plan introuvable");
  return toPlan(data);
}

export async function getSubscription(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Subscription | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan_id, status, stripe_customer_id, current_period_end, cancel_at_period_end")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) return null;
  return {
    planId: data.plan_id,
    status: data.status,
    stripeCustomerId: data.stripe_customer_id,
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end,
  };
}

export async function getCreditBalance(supabase: SupabaseClient, organizationId: string): Promise<number> {
  const { data, error } = await supabase.rpc("credit_balance", { org: organizationId });
  if (error) throw error;
  return data ?? 0;
}

export async function listCreditTransactions(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 50,
): Promise<CreditTransaction[]> {
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("id, amount, reason, description, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    amount: t.amount,
    reason: t.reason,
    description: t.description,
    createdAt: t.created_at,
  }));
}

export async function listCreditPrices(supabase: SupabaseClient): Promise<CreditPrice[]> {
  const { data, error } = await supabase.from("credit_prices").select("action, credits, label").order("credits");
  if (error) throw error;
  return data ?? [];
}

export const REASON_LABELS: Record<string, string> = {
  welcome: "Bienvenue",
  subscription: "Abonnement",
  top_up: "Recharge",
  manual: "Ajustement",
  refund: "Remboursement",
  theme_install: "Thème installé",
  image_generation: "Image générée",
};

export function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100,
  );
}
