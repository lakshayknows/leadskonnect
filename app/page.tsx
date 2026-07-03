import Nav from "@/components/marketing/Nav";
import Hero from "@/components/marketing/Hero";
import ChannelCards from "@/components/marketing/ChannelCards";
import HowItWorks from "@/components/marketing/HowItWorks";
import Safety from "@/components/marketing/Safety";
import CTA from "@/components/marketing/CTA";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ChannelCards />
        <HowItWorks />
        <Safety />
        <CTA />
      </main>
    </>
  );
}
