export function LoadingSkeleton() {
  return (
    <div
      aria-live="polite"
      className="opensphinx-loading-skeleton"
      role="status"
    >
      <p>Preparing the next question...</p>
    </div>
  );
}
