import { cn } from '@/lib/utils';
import { FEEDBACK_SUBJECT, feedbackMailto } from '@/lib/feedback';

/**
 * A plain mailto link for feedback, prefilled with a subject. It is a real
 * anchor, so it works with no JavaScript and opens the visitor's mail app.
 * Callers place it and size it; nothing here sends anything by itself.
 */
export function SendFeedbackLink({
  className,
  subject = FEEDBACK_SUBJECT,
}: {
  className?: string;
  subject?: string;
}) {
  return (
    <a
      href={feedbackMailto(subject)}
      data-testid="send-feedback"
      className={cn(
        'inline-flex min-h-11 items-center rounded-sm text-text-secondary transition-colors hover:text-text-primary focus-ring',
        className,
      )}
    >
      Send feedback
    </a>
  );
}
