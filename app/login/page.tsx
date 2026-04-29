import { LoginForm } from "@/components/auth/login-form";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export const metadata = {
  title: "Admin Login - Agent RAG",
  description: "Sign in to access the admin dashboard",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If already logged in, redirect to admin
  if (user) {
    redirect("/admin");
  }

  return <LoginForm />;
}
