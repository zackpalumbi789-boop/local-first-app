import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const handlers = toNextJsHandler(auth);

function shouldLog(url: URL): boolean {
  const path = url.pathname;
  return (
    path.includes("/api/auth/sign-in/social") ||
    path.includes("/api/auth/callback/github") ||
    path.includes("/api/auth/error")
  );
}

async function logWrapped(
  method: "GET" | "POST",
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev && shouldLog(url)) {
    console.info("[auth-route]", method, url.pathname, url.search);
  }

  try {
    const handler = method === "GET" ? handlers.GET : handlers.POST;
    const response = await handler(request);
    if (isDev && shouldLog(url)) {
      console.info("[auth-route] response", response.status, url.pathname);
    }
    return response;
  } catch (error) {
    console.error("[auth-route] crash", method, url.pathname, error);
    throw error;
  }
}

export async function GET(request: Request) {
  return logWrapped("GET", request);
}

export async function POST(request: Request) {
  return logWrapped("POST", request);
}
