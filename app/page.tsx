import RecipeApp from "./components/RecipeApp";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <RecipeApp
      initialUser={
        session?.user?.email
          ? {
              email: session.user.email,
            }
          : null
      }
    />
  );
}
