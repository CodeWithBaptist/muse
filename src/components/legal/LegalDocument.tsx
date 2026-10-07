import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

/**
 * A legal document rendered from real product behaviour.
 *
 * Sections carry prose and optional lists rather than bracketed prompts, so
 * the page reads as a document instead of a template. The status note stays
 * visible at the top of every draft: these pages describe what MUSE actually
 * does today, and they still require legal review before publication.
 */

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
  /** Optional note rendered under a section, for open items and caveats. */
  note?: string;
}

export interface LegalReference {
  label: string;
  href: string;
}

export function LegalDocument({
  title,
  statusNote,
  intro,
  sections,
  references = [],
}: {
  title: string;
  statusNote: string;
  intro: string;
  sections: LegalSection[];
  references?: LegalReference[];
}) {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-text-primary sm:py-16">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center text-xs text-text-secondary transition-colors hover:text-text-primary focus-ring"
        >
          Back to MUSE
        </Link>

        <header className="space-y-3">
          <p className="type-section-label text-accent">{statusNote}</p>
          <h1 className="type-page-title">{title}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
            {intro}
          </p>
        </header>

        <div className="space-y-6">
          {sections.map((section) => (
            <section
              key={section.title}
              className="space-y-3 border-t border-border-subtle pt-5"
            >
              <h2 className="text-base font-semibold text-text-primary">
                {section.title}
              </h2>

              {section.paragraphs?.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-sm leading-relaxed text-text-secondary"
                >
                  {paragraph}
                </p>
              ))}

              {section.items && section.items.length > 0 && (
                <ul className="space-y-1.5 text-sm leading-relaxed text-text-secondary">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1 w-1 shrink-0 rounded-full bg-border-strong"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              {section.note && (
                <p className="border-l-2 border-border-strong pl-3 text-sm leading-relaxed text-text-muted">
                  {section.note}
                </p>
              )}
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
                    className="inline-flex min-h-10 items-center gap-1.5 text-sm text-accent transition-colors hover:text-text-primary focus-ring"
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
