import * as React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

/**
 * Layout for the legal pages.
 *
 * Every page using it is a draft written from how the code behaves today. The
 * "Draft for review" label, the notice under the title, and the review list at
 * the end stay until a human has reviewed and approved the text; nothing here
 * pretends to be in force.
 */

/** The date all three drafts were written. Update it when the text changes. */
export const LEGAL_DRAFT_DATE = '9 October 2026';

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
  /** Human readable date of the draft, for example "7 October 2026". */
  draftDate: string;
  sections: LegalSection[];
  /** What a reviewer must confirm or fill in before this text is published. */
  reviewNotes: string[];
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
  reviewNotes,
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
          <p className="type-section-label text-accent">Draft for review</p>
          <h1 className="type-page-title">{title}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
            {summary}
          </p>
          <p className="text-xs text-text-muted">Draft dated {draftDate}</p>
          <div
            role="note"
            className="rounded-md border border-border-strong bg-surface px-4 py-3 text-sm leading-relaxed text-text-secondary"
          >
            This draft was written from how MUSE works today, by reading the
            code that handles sign-in, storage, and the AI requests. It has not
            been reviewed by a lawyer and is not yet in force. Values in square
            brackets still have to be filled in.
          </div>
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

        <section
          aria-labelledby="review-heading"
          className="space-y-3 rounded-md border border-border bg-surface p-5"
        >
          <h2 id="review-heading" className="type-section-label">
            Before this is published
          </h2>
          <LegalList items={reviewNotes} />
        </section>

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
