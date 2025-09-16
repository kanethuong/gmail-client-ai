"use client";

import { handleSignIn, handleSignOut } from "../lib/auth";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect authenticated users to main page
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/main-page");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-lg">Loading...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">
          Gmail Client AI
        </h1>
        <p className="mb-8 text-gray-600">
          Sign in with Google to sync and manage your Gmail emails
        </p>
        <button
          onClick={handleSignIn}
          className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
