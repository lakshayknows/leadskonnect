import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, requireDb } from "@/lib/http";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

const AccountSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  host: z.string().min(1),
  port: z.number().int().positive(),
  secure: z.boolean().default(false),
  user: z.string().min(1),
  pass: z.string().min(1),
  from: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

export async function GET() {
  const guard = requireDb();
  if (guard) return guard;
  // Never expose secrets (pass / refreshToken) to the client.
  const accounts = await prisma.sendingAccount.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      provider: true,
      host: true,
      port: true,
      secure: true,
      user: true,
      from: true,
      active: true,
      createdAt: true,
    },
  });
  return ok(accounts);
}

export async function POST(req: NextRequest) {
  const guard = requireDb();
  if (guard) return guard;

  try {
    const body = await req.json().catch(() => null);
    const isTestOnly = req.nextUrl.searchParams.get("test") === "true";
    const parsed = AccountSchema.safeParse(body);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid account input data");
    }

    const data = parsed.data;

    // Test connection
    const transporter = nodemailer.createTransport({
      host: data.host,
      port: data.port,
      secure: data.secure,
      auth: {
        user: data.user,
        pass: data.pass,
      },
    });

    try {
      await transporter.verify();
    } catch (testErr) {
      console.error("[sending-accounts] SMTP connection verification failed:", testErr);
      return fail(
        `SMTP Connection failed: ${testErr instanceof Error ? testErr.message : String(testErr)}`,
        400
      );
    }

    if (isTestOnly) {
      return ok({ message: "SMTP connection verified successfully!" });
    }

    // Check if account already exists with this email
    const existing = await prisma.sendingAccount.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return fail(`A sending account with email ${data.email} already exists`, 400);
    }

    const account = await prisma.sendingAccount.create({
      data: {
        name: data.name,
        email: data.email,
        host: data.host,
        port: data.port,
        secure: data.secure,
        user: data.user,
        pass: data.pass,
        from: data.from || null,
        active: data.active,
      },
    });

    return ok(account, { status: 201 });
  } catch (err) {
    console.error("[sending-accounts] failed to handle POST request:", err);
    return fail(err instanceof Error ? err.message : "Internal Server Error", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const guard = requireDb();
  if (guard) return guard;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("Missing account 'id' parameter");

  try {
    await prisma.sendingAccount.delete({
      where: { id },
    });
    return ok({ deleted: id });
  } catch (err) {
    console.error("[sending-accounts] failed to delete account:", err);
    return fail("Account not found or could not be deleted", 400);
  }
}
