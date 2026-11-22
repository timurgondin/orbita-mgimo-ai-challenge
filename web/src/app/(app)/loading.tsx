export default function Loading() {
  return (
    <div className="sk" aria-hidden="true">
      <div className="h-[38px] w-48 max-sm:h-8 max-sm:w-40" />
      <div className="mt-10 h-40 w-full max-sm:mt-8" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-28" />
        <div className="h-28" />
      </div>
      <div className="mt-6 h-16 w-full" />
      <div className="mt-3 h-16 w-full" />
    </div>
  );
}
