import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { listMyOrganizations } from "@/modules/organizations/queries";
import { ROLE_LABELS } from "@/modules/organizations/types";
import { getCreditBalance, getOrganizationPlan, listCreditPrices } from "@/modules/billing/queries";
import { defaultOrganizationId, errorResult, mcpContext, NOT_AUTHENTICATED, resolveAgency, textResult } from "../context";

export function registerAccountTools(server: McpServer) {
  server.registerTool(
    "list_my_agencies",
    {
      title: "Mes agences",
      description:
        "Liste les agences Webuild de l'utilisateur, son rôle, le solde de crédits de chacune et l'agence par défaut. " +
        "Si l'utilisateur a plusieurs agences et n'a pas précisé laquelle utiliser pour une nouvelle boutique, " +
        "demande-lui avant toute action payante.",
      annotations: { readOnlyHint: true },
    },
    async (ctx) => {
      const context = mcpContext(ctx);
      if (!context) return NOT_AUTHENTICATED;

      const organizations = await listMyOrganizations(context.supabase, context.userId);
      const defaultId = await defaultOrganizationId(context, organizations);
      const agencies = await Promise.all(
        organizations.map(async (org) => ({
          name: org.name,
          slug: org.slug,
          role: ROLE_LABELS[org.role],
          credits: await getCreditBalance(context.supabase, org.id),
          isDefault: org.id === defaultId,
        })),
      );

      return textResult({
        user: { email: context.email ?? null },
        defaultAgency: agencies.find((a) => a.isDefault)?.slug ?? null,
        agencies,
      });
    },
  );

  server.registerTool(
    "get_account_status",
    {
      title: "État du compte",
      description:
        "Plan, solde de crédits et prix des actions (installation de thème, image) pour une agence. " +
        "À consulter avant une série d'actions payantes.",
      inputSchema: z.object({
        agency: z.string().optional().describe("Slug de l'agence. Par défaut : l'agence par défaut."),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ agency }, ctx) => {
      const context = mcpContext(ctx);
      if (!context) return NOT_AUTHENTICATED;

      const resolved = await resolveAgency(context, { agency });
      if ("error" in resolved) return errorResult(resolved.error);
      const { organization } = resolved;

      const [plan, credits, prices] = await Promise.all([
        getOrganizationPlan(context.supabase, organization.id),
        getCreditBalance(context.supabase, organization.id),
        listCreditPrices(context.supabase),
      ]);

      return textResult({
        agency: organization.slug,
        plan: { name: plan.name, monthlyCredits: plan.monthlyCredits, maxMembers: plan.maxMembers },
        credits,
        prices: Object.fromEntries(prices.map((p) => [p.action, { credits: p.credits, label: p.label }])),
        manageUrl: `${context.appOrigin}/dashboard/${organization.slug}/billing`,
      });
    },
  );
}
