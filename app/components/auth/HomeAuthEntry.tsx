"use client";

import Link from "next/link";
import LogoutButton from "./LogoutButton";
import { authClient } from "@/lib/auth-client";

type InitialUser = {
  email: string;
} | null;

type Props = {
  initialUser?: InitialUser;
};

export default function HomeAuthEntry({ initialUser = null }: Props) {
  const { data: session } = authClient.useSession();
  const user = session?.user ?? initialUser;

  if (!user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/login" style={{ fontSize: 13, color: "#5B5146" }}>
          登录
        </Link>
        <Link
          href="/register"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#1C1915",
            background: "#EDE8DF",
            padding: "6px 10px",
            borderRadius: 8,
          }}
        >
          注册
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 12, color: "#5B5146", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {user.email}
      </span>
      <LogoutButton redirectTo="/" />
    </div>
  );
}
