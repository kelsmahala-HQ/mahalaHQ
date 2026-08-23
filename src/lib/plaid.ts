import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

export function createPlaidClient() {
  const env = process.env.PLAID_ENV === "production" ? "production" : "sandbox";

  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
        "PLAID-SECRET": process.env.PLAID_SECRET!,
      },
    },
  });

  return new PlaidApi(configuration);
}
