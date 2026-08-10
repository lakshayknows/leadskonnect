"use client";

import useSWR from "swr";
import { MessageCircle, Smartphone, AlertTriangle } from "lucide-react";
import { DashHeader, Panel, Badge, Skeleton } from "@/components/ui";

type Status = {
  whatsapp: { configured: boolean; fromMasked: string | null };
  sms: { configured: boolean };
};

export default function ChannelsClient() {
  const { data, isLoading } = useSWR<Status>("/api/channels/status");

  return (
    <>
      <DashHeader
        title="Business channels"
        subtitle="WhatsApp and SMS are business identities, not personal ones — one verified number for the whole org, not something each rep connects individually."
      />

      <div className="mx-auto max-w-2xl space-y-4 p-8">
        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </>
        ) : (
          <>
            <Panel>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-tint">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-base font-bold">WhatsApp</h2>
                    <p className="text-xs text-ink-soft">
                      {data?.whatsapp.fromMasked ? `Sending from ${data.whatsapp.fromMasked}` : "No sending number configured"}
                    </p>
                  </div>
                </div>
                <Badge tone={data?.whatsapp.configured ? "success" : "neutral"}>
                  {data?.whatsapp.configured ? "Connected" : "Not connected"}
                </Badge>
              </div>
              <p className="mt-4 text-sm text-ink-soft">
                Set up via a Meta Business Manager account (or Twilio's Embedded Signup) and configured through
                <code className="mx-1 rounded bg-tint px-1.5 py-0.5 font-mono text-xs">TWILIO_ACCOUNT_SID</code>,
                <code className="mx-1 rounded bg-tint px-1.5 py-0.5 font-mono text-xs">TWILIO_AUTH_TOKEN</code>, and
                <code className="mx-1 rounded bg-tint px-1.5 py-0.5 font-mono text-xs">TWILIO_WHATSAPP_FROM</code>
                — a verified business number represents the whole org, so this is set once at the environment
                level rather than per member. Free-form replies only work within 24h of the contact's last
                message; outside that window an approved template is required.
              </p>
            </Panel>

            <Panel>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-tint">
                    <Smartphone className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-base font-bold">SMS</h2>
                    <p className="text-xs text-ink-soft">India — gated by DLT registration</p>
                  </div>
                </div>
                <Badge tone="neutral">Not available yet</Badge>
              </div>
              <div className="mt-4 flex gap-2.5 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-warning-strong">
                <AlertTriangle className="h-4 w-4 shrink-0 translate-y-0.5" />
                <p>
                  SMS needs DLT registration (Principal Entity + Sender ID + approved templates) with a telecom
                  operator before any code can send through it — that's a days-to-weeks external process, not a
                  configuration step. It's intentionally not built until that groundwork exists.
                </p>
              </div>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
