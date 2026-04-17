type OpenSphinxMarkProps = {
  readonly className?: string;
  readonly size?: number;
};

export function OpenSphinxMark({ className, size = 20 }: OpenSphinxMarkProps) {
  return (
    <img
      alt=""
      aria-hidden
      className={className}
      decoding="async"
      height={size}
      loading="eager"
      src="/icon.png"
      width={size}
    />
  );
}
