import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { runJob } from "@/lib/job-router";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const receiver = env.qstash.currentSigningKey && env.qstash.nextSigningKey
  ? new Receiver({
      currentSigningKey: env.qstash.currentSigningKey,
      nextSigningKey: env.qstash.nextSigningKey,
    })
  : null;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.clone().text();

    // Verify signature in production
    if (receiver && process.env.NODE_ENV === "production") {
      const signature = req.headers.get("upstash-signature");
      if (!signature) {
        return new NextResponse("Unauthorized: Missing Upstash Signature", { status: 401 });
      }

      const isValid = await receiver.verify({
        signature,
        body: rawBody,
        url: `${env.appUrl}/api/qstash/process`,
      }).catch((e) => {
        console.error("[QStash] Signature verification failed:", e);
        return false;
      });

      if (!isValid) {
        return new NextResponse("Unauthorized: Invalid Upstash Signature", { status: 401 });
      }
    }

    const jobData = JSON.parse(rawBody);
    console.log("[QStash] Received job:", jobData?.kind ?? "send");

    const result = await runJob(jobData);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[QStash] Process endpoint error:", err);
    return new NextResponse(
      err instanceof Error ? err.message : "Internal Server Error",
      { status: 500 }
    );
  }
}
