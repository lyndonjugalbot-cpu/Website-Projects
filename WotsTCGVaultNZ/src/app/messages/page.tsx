import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MessagesView } from "@/components/messages/messages-view";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/messages");
  return <MessagesView currentUserId={session.user.id} />;
}
