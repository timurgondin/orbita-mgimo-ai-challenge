import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** Семестра нет в архиве: не подсказываем, существует ли он. */
export default function CourseNotFound() {
  return (
    <>
      <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Семестр не найден</h1>
      <Link href="/study" className="-ml-1 mt-4 inline-flex items-center gap-0.5 text-[15px] text-text-2 transition-colors duration-150 hover:text-text">
        <ChevronLeft size={17} strokeWidth={1.6} />
        Все курсы
      </Link>
    </>
  );
}
