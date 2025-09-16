import { signIn, signOut } from "next-auth/react";

// Client-side authentication helpers
export const handleSignIn = () => signIn("google");
export const handleSignOut = () => signOut();