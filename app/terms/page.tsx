import LegalPage from "@/components/site/LegalPage";

export const metadata = { title: "Terms — LeadsKonnect" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="July 2026"
      sections={[
        { heading: "Acceptable use", body: "You agree to send only to contacts you have a lawful basis to reach, to honor opt-outs, and to respect each platform's terms and limits." },
        { heading: "Your account", body: "You're responsible for the credentials you connect and the messages you send. Keep your API keys secure." },
        { heading: "Service availability", body: "We aim for high availability but provide the service 'as is'. Rate limits and platform behavior are outside our control." },
        { heading: "Termination", body: "You may cancel anytime. We may suspend accounts that abuse the service or send unlawful outreach." },
        { heading: "Changes", body: "We may update these terms; material changes will be announced in-app and via email." },
      ]}
    />
  );
}
