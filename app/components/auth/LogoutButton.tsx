"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Props = {
  redirectTo?: string;
};

export default function LogoutButton({ redirectTo = "/login" }: Props) {
  const router = useRouter();

  const handleLogout = async () => {
    const { error } = await authClient.signOut();
    if (!error) {
      router.push(redirectTo);
      router.refresh();
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
    >
      退出登录
    </button>
  );
}
