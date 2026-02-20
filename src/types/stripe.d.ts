// Stripe type declaration — stripe is an optional dependency (not always installed).
// This prevents "Cannot find module 'stripe'" errors in development.
// When stripe is installed via `npm install stripe`, its own types take precedence.
declare module 'stripe' {
  interface StripeCheckoutSession {
    id: string;
    payment_intent?: string;
    metadata: Record<string, string>;
  }

  interface StripeEvent {
    type: string;
    data: {
      object: StripeCheckoutSession;
    };
  }

  interface StripeWebhooks {
    constructEvent(body: string, signature: string, secret: string): StripeEvent;
  }

  interface StripeCheckoutSessions {
    create(params: Record<string, unknown>): Promise<StripeCheckoutSession>;
  }

  interface StripeCheckout {
    sessions: StripeCheckoutSessions;
  }

  interface StripeInstance {
    checkout: StripeCheckout;
    webhooks: StripeWebhooks;
  }

  class Stripe {
    constructor(secret: string, opts?: Record<string, unknown>);
    checkout: StripeCheckout;
    webhooks: StripeWebhooks;
  }

  export default Stripe;
}
