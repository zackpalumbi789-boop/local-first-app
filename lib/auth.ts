import { betterAuth } from "better-auth";
import { verifyPassword as defaultVerifyPassword } from "better-auth/crypto";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as authSchema from "@/db/auth-schema";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const DEV_HASH_PREFIX = "devscrypt$";

function scryptAsync(
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

async function devHashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(password.normalize("NFKC"), salt, 64, {
    N: 1024,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 8 * 2,
  });
  return `${DEV_HASH_PREFIX}${salt}:${key.toString("hex")}`;
}

async function devVerifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  // Legacy hashes (default Better Auth scrypt) still supported.
  if (!hash.startsWith(DEV_HASH_PREFIX)) {
    return defaultVerifyPassword({ hash, password });
  }

  const body = hash.slice(DEV_HASH_PREFIX.length);
  const [salt, keyHex] = body.split(":");
  if (!salt || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = await scryptAsync(password.normalize("NFKC"), salt, expected.length, {
    N: 1024,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 8 * 2,
  });

  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

const useFastDevPasswordHash = process.env.NODE_ENV !== "production";
const hasGithubOAuth =
  Boolean(process.env.GITHUB_CLIENT_ID) &&
  Boolean(process.env.GITHUB_CLIENT_SECRET);

export const auth = betterAuth({
  appName: "Local First App",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    ...(useFastDevPasswordHash
      ? {
          password: {
            hash: devHashPassword,
            verify: devVerifyPassword,
          },
        }
      : {}),
  },
  ...(hasGithubOAuth
    ? {
        socialProviders: {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
          },
        },
      }
    : {}),
});
