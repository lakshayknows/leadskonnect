import Nav from "@/components/marketing/Nav";
import Footer from "./Footer";

/** Standard page frame: floating nav + content + shared footer. */
export default function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}
