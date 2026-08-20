import { prisma } from "@/lib/prisma";
import { sendEmail, orderUpdateTemplate } from "@/lib/email";
import type { NotificationType } from "@prisma/client";

/**
 * Single entry point for every payment-flow notification: writes an
 * in-app `Notification` row and sends the matching email in one call, so
 * every trigger point (webhook handler, payout sweep, dispute actions...)
 * only has to describe *what* happened, not duplicate the "how do I notify
 * this user" plumbing.
 */
export async function notifyUser(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  email?: { to: string; name: string } | null;
}) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
    },
  });

  if (params.email) {
    await sendEmail({
      to: params.email.to,
      subject: params.title,
      html: orderUpdateTemplate(params.email.name, params.body, params.link ?? process.env.NEXT_PUBLIC_SITE_URL!),
    });
  }
}

/** Notifies every staff member with a payments-relevant admin role (used for dispute/fraud/failure alerts). */
export async function notifyAdmins(params: { title: string; body: string; link?: string }) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "SUPPORT"] }, status: "ACTIVE" },
    select: { id: true },
  });
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: "SYSTEM" as const,
      title: params.title,
      body: params.body,
      link: params.link,
    })),
  });
}
