import "server-only";
import Stripe from "stripe";

let client: Stripe | undefined;

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Variable d'environnement manquante : STRIPE_SECRET_KEY");
  }
  client ??= new Stripe(secretKey);
  return client;
}
