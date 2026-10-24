import { Loading } from "@/components/ui";

// Chaque page lit la session et la base : sans ce repli propre au segment, une navigation
// entre deux pages de l'agence attendrait le serveur au lieu d'afficher le chargement.
export default function OrganizationLoading() {
  return <Loading />;
}
