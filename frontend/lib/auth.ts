/**
 * Better Auth — server-side config.
 * Only imported in Server Components and API routes (never in 'use client').
 */

import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";
import { Pool } from "pg";

export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET!,
	baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

	// Transaction Pooler (port 6543) — required for Vercel serverless + local IPv4
	// Uses explicit params to avoid URL-encoding issues with the dotted username
	database: new Pool({
		host: "aws-1-us-west-2.pooler.supabase.com",
		port: 6543,
		user: "postgres.umzqqrujfnqfearjmbyn",
		password: process.env.SUPABASE_DB_PASSWORD,
		database: "postgres",
		ssl: { rejectUnauthorized: false },
		// Transaction Pooler does not support prepared statements
		max: 1,
	}),

	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		},
		github: {
			clientId: process.env.GITHUB_CLIENT_ID!,
			clientSecret: process.env.GITHUB_CLIENT_SECRET!,
		},
	},

	redirects: {
		afterSignIn: "/dashboard/dataset",
		afterSignOut: "/login",
	},

	plugins: [
		anonymous({
			onLinkAccount: async ({ anonymousUser, newUser }) => {
				console.log(
					`Guest ${anonymousUser.user.id} linked to ${newUser.user.id}`,
				);
			},
		}),
	],
});
