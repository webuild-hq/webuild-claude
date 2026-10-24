import { publicOrigin } from "@/lib/origin";
import { MCP_PATH } from "@/lib/mcp/metadata";
import { Card, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { loadOrganization } from "../context";

export const metadata = { title: "Connecter Claude | Webuild" };

const PROMPTS = [
  "Liste mes agences Webuild et dis-moi combien de crédits il me reste.",
  "Montre-moi les thèmes Webuild et aide-moi à choisir pour une marque de soins naturels.",
  "Installe le thème Skeleton de Webuild sur ma boutique Shopify en brouillon, remplis la page d'accueil pour une marque de bougies artisanales et génère l'image de la section principale.",
  "Je valide l'aperçu : publie le thème.",
];

export default async function ConnectClaudePage({ params }: PageProps<"/dashboard/[org]/claude">) {
  const { org: slug } = await params;
  const { organization } = await loadOrganization(slug, "/claude");
  const mcpUrl = `${await publicOrigin()}${MCP_PATH}`;

  return (
    <>
      <PageHeader
        title="Connecter Claude"
        description="Une fois connecté, Claude utilise les thèmes et les outils Webuild pour construire les boutiques de tes clients."
      />

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="font-semibold">1. Ajouter le connecteur Webuild</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
          <li>Dans Claude : Paramètres, Connecteurs, Ajouter un connecteur personnalisé.</li>
          <li>Nom : Webuild. URL : celle ci-dessous.</li>
          <li>Connecte-toi avec ton compte Webuild, puis choisis l&apos;agence par défaut ({organization.name}).</li>
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <code className="break-all rounded-lg bg-background px-3 py-2 text-sm">{mcpUrl}</code>
          <CopyButton value={mcpUrl} label="Copier l'URL" />
        </div>
        <p className="text-xs text-muted">
          Sur les plans Claude Team et Enterprise, un administrateur ajoute le connecteur pour l&apos;organisation,
          puis chaque membre s&apos;y connecte avec son propre compte Webuild.
        </p>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="font-semibold">2. Connecter Shopify</h2>
        <p className="text-sm">
          Ajoute aussi le connecteur Shopify officiel dans Claude, connecté à la boutique de ton client. C&apos;est lui
          qui installe le thème, crée les fichiers et publie : Webuild n&apos;a jamais accès à la boutique.
        </p>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="font-semibold">3. C&apos;est prêt</h2>
        <p className="text-sm">
          Rien d&apos;autre à installer : le connecteur fournit à Claude la méthode complète (choix du thème,
          installation en brouillon, sections, images, validation puis publication). Pour démarrer en un clic, choisis
          &laquo; Construire une boutique avec Webuild &raquo; dans le menu + de Claude, ou écris simplement ta demande.
        </p>
        <p className="text-xs text-muted">
          Avec Claude Code, tu peux aussi installer la méthode comme skill :{" "}
          <a href="/api/skill/download" className="underline hover:text-foreground">
            télécharger la skill
          </a>
          .
        </p>
      </Card>

      <Card className="flex flex-col gap-3 p-6">
        <h2 className="font-semibold">Exemples de demandes</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {PROMPTS.map((prompt) => (
            <li key={prompt} className="rounded-lg bg-background px-3 py-2">
              {prompt}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
