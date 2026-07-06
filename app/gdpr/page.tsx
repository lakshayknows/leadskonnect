import LegalPage from "@/components/site/LegalPage";

export const metadata = { title: "GDPR — Followthroo" };

export default function GdprPage() {
  return (
    <LegalPage
      title="GDPR"
      updated="July 2026"
      sections={[
        { heading: "Lawful basis", body: "You must have a lawful basis (consent or legitimate interest) to contact each person you import. WhatsApp outreach requires explicit opt-in." },
        { heading: "Data subject rights", body: "We support access, rectification, and erasure. Deleting a lead removes their record and suppresses future contact." },
        { heading: "Unsubscribe", body: "Every email includes an unsubscribe path; replies of 'stop' or 'unsubscribe' on any channel add the contact to the global suppression list." },
        { heading: "Data processing", body: "We act as a processor for the lead data you control. A Data Processing Addendum is available on request for Scale plans." },
        { heading: "Data location", body: "Data is stored in your configured database and provider regions. You choose where Postgres and Redis run." },
      ]}
    />
  );
}
