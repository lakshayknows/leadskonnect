/** Pure-logic checks for the enhancements: email formatting + sender-name fill. */
import { formatEmailBody, renderMessage } from "../lib/templates";

let pass = 0, fail = 0;
const a = (c: boolean, l: string) => (c ? (pass++, console.log("  ✓", l)) : (fail++, console.error("  ✗", l)));

const html = formatEmailBody("Hi Jane,\n\nFirst para.\nSecond line.\n\nThanks,\n{{x}}");
a(/<p[ >]/.test(html), "formatEmailBody wraps paragraphs");
a((html.match(/<p/g) || []).length === 3, "three paragraphs");
a(html.includes("<br>"), "single newline → <br>");
a(formatEmailBody("<p>already</p>") === "<p>already</p>", "HTML body left unchanged (idempotent)");

const r = renderMessage(
  { subject: "Hi {{firstName}}", body: "Hey {{firstName}},\n\nBest,\n[Your Name]" },
  { firstName: "Jane" },
  { senderName: "Lakshay" }
);
a(r.body.includes("Hey Jane,"), "firstName rendered");
a(r.body.includes("Best,\nLakshay") && !r.body.includes("[Your Name]"), "[Your Name] replaced with senderName");

const r2 = renderMessage({ subject: "", body: "Sign: {{senderName}}" }, {}, { senderName: "Lakshay" });
a(r2.body === "Sign: Lakshay", "{{senderName}} variable rendered");

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
