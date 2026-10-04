import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

export interface LegalPlaceholderSection {
  title: string;
  prompt: string;
}

export function LegalPlaceholder({
  title,
  intro,
  sections,
  references = [],
}: {
  title: string;
  intro: string;
  sections: LegalPlaceholderSection[];
  references?: { label: string; href: string }[];
}) {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-text-primary sm:py-16">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/"
          className="inline-flex items-center text-xs text-text-secondary transition-colors hover:text-text-primary"
        >
          Back to MUSE
        </Link>

        <header className="space-y-3">
          <p className="type-section-label text-accent">
            Placeholder for review
          </p>
          <h1 className="type-page-title">{title}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
            {intro}
          </p>
        </header>

        <div className="space-y-6">
          {sections.map((section) => (
            <section
              key={section.title}
              className="space-y-2 border-t border-border-subtle pt-5"
            >
              <h2 className="text-base font-semibold text-text-primary">
                {section.title}
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary">
                {section.prompt}
              </p>
            </section>
          ))}
        </div>

        {references.length > 0 && (
          <section className="space-y-3 border-t border-border-subtle pt-5">
            <h2 className="text-base font-semibold text-text-primary">
              Official references
            </h2>
            <ul className="space-y-2">
              {references.map((reference) => (
                <li key={reference.href}>
                  <a
                    href={reference.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-accent transition-colors hover:text-text-primary"
                  >
                    {reference.label}
                    <ExternalLink size={13} />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
