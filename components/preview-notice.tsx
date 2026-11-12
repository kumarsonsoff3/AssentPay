import Link from "next/link";
import { ArrowLeft } from "@/components/icons";
import { Brand } from "@/components/brand";

export function PreviewNotice({
  title,
  introduction,
  sections,
}: {
  title: string;
  introduction: string;
  sections: { title: string; text: string }[];
}) {
  return (
    <main className="landing-shell max-w-190 py-10 sm:py-16">
      <Link href="/" aria-label="AssentPay home">
        <Brand />
      </Link>
      <p className="landing-eyebrow mt-12">
        PRODUCT PREVIEW · OCTOBER 19, 2026
      </p>
      <h1 className="landing-heading">{title}</h1>
      <p className="landing-description mt-5">{introduction}</p>
      <div className="my-9 rounded-xl border border-[#dbe5f5] bg-[#f4f7fd] p-5 text-[13px] leading-[1.9] text-[#526782]">
        This page covers the current demonstration site. Production policies
        will be published before accounts, connected business data, or live
        payments become available.
      </div>
      {sections.map(section => (
        <section key={section.title} className="my-8">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <p className="mt-3 text-sm leading-[1.9] text-[#61718a]">
            {section.text}
          </p>
        </section>
      ))}
      <Link href="/" className="landing-text-link mt-8">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to AssentPay
      </Link>
    </main>
  );
}
