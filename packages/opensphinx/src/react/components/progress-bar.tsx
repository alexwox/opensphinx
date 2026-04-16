export interface ProgressBarProps {
  readonly current: number;
  readonly max: number;
}

export function ProgressBar({ current, max }: ProgressBarProps) {
  const safeMax = max <= 0 ? 1 : max;
  const clampedCurrent = Math.max(0, Math.min(current, safeMax));
  const percent = Math.round((clampedCurrent / safeMax) * 100);

  return (
    <div className="opensphinx-progress" data-progress={percent}>
      <div
        aria-hidden="true"
        className="opensphinx-progress__bar"
        style={{ width: `${percent}%` }}
      />
      <p className="opensphinx-progress__label">
        {clampedCurrent} / {safeMax}
      </p>
    </div>
  );
}
