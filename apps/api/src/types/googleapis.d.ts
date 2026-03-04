/** Optional: install googleapis for Android IAP verification. */
declare module 'googleapis' {
  const google: {
    auth: { GoogleAuth: new (opts: { keyFile: string; scopes: string[] }) => unknown };
    androidpublisher: (opts: { version: string; auth: unknown }) => {
      purchases: {
        subscriptions: {
          get: (opts: { packageName: string; subscriptionId: string; token: string }) => Promise<{
            data: { paymentState?: number; expiryTimeMillis?: string; orderId?: string };
          }>;
        };
      };
    };
  };
  export { google };
}
