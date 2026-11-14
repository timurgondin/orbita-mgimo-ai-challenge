export function PagePlaceholder({ title }: { title: string }) {
  return (
    <>
      <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em]">{title}</h1>
      <p className="mt-2 text-text-2">Раздел в разработке</p>
    </>
  );
}
