import * as React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

/** Layout for public legal pages. Editorial review notes live in docs/legal-todo.md. */

/** The date all three legal pages were last updated. */
export const LEGAL_DRAFT_DATE = '13 October 2026';

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

export interface LegalReference {
  label: string;
  href: string;
}

export interface LegalDocumentProps {
  title: string;
  /** One plain-language paragraph about what the page covers. */
  summary: string;
  /** Human readable date of the latest legal update. */
  draftDate: string;
  sections: LegalSection[];
  references?: LegalReference[];
}

/** A value the operator has to fill in. Visibly marked so it cannot ship unnoticed. */
export function Placeholder({ children }: { children: string }) {
  return (
    <span
      data-legal-placeholder=""
      className="rounded-sm border border-dashed border-border-strong px-1 text-text-primary"
    >
      [{children}]
    </span>
  );
}

export function LegalParagraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-text-secondary">{children}</p>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-secondary marker:text-text-muted">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

const LINK_CLASS =
  'text-text-primary underline underline-offset-4 transition-colors hover:text-accent focus-ring rounded-sm';

export function LegalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={LINK_CLASS}>
        {children}
      </a>
    );
  }
  if (href.startsWith('mailto:')) {
    return (
      <a href={href} className={LINK_CLASS}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={LINK_CLASS}>
      {children}
    </Link>
  );
}

export function LegalDocument({
  title,
  summary,
  draftDate,
  sections,
  references = [],
}: LegalDocumentProps) {
  return (
    <main className="min-h-screen bg-background px-4 py-10 text-text-primary sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl space-y-10">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center rounded-sm text-xs text-text-secondary transition-colors hover:text-text-primary focus-ring"
        >
          Back to MUSE
        </Link>

        <header className="space-y-4">
          <h1 className="type-page-title">{title}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
            {summary}
          </p>
          <p className="text-xs text-text-muted">Last updated: {draftDate}</p>
        </header>

        <nav
          aria-label="Sections"
          className="border-t border-border-subtle pt-6"
        >
          <ol className="grid gap-1 text-sm sm:grid-cols-2">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-sm text-text-secondary transition-colors hover:text-text-primary focus-ring"
                >
                  <span className="tabular-nums text-text-muted">
                    {index + 1}.
                  </span>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          {sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-heading`}
              className="scroll-mt-24 space-y-3"
            >
              <h2
                id={`${section.id}-heading`}
                className="text-base font-semibold text-text-primary"
              >
                <span className="mr-2 tabular-nums text-text-muted">
                  {index + 1}.
                </span>
                {section.title}
              </h2>
              <div className="space-y-3">{section.body}</div>
            </section>
          ))}
        </div>

        {references.length > 0 ? (
          <section aria-labelledby="references-heading" className="space-y-3">
            <h2 id="references-heading" className="type-section-label">
              References
            </h2>
            <ul className="space-y-1">
              {references.map((reference) => (
                <li key={reference.href}>
                  <a
                    href={reference.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center gap-2 rounded-sm text-sm text-text-secondary transition-colors hover:text-text-primary focus-ring"
                  >
                    {reference.label}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="border-t border-border-subtle pt-6">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center rounded-sm text-xs text-text-secondary transition-colors hover:text-text-primary focus-ring"
          >
            Back to MUSE
          </Link>
        </footer>
      </div>
    </main>
  );
}
