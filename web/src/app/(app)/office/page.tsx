import { OfficeView } from "@/components/office/office-view";
import { getOfficeData } from "@/server/data/office";
import { TeachOffice } from "@/components/teach/teach-office";
import { getTeachCourses } from "@/server/data/teach";

export default async function OfficePage() {
  const teach = await getTeachCourses();
  if (teach) {
    return <TeachOffice sheets={teach.map((c) => ({ slug: c.slug, title: c.title, color: c.color, students: c.students, when: c.exam ?? "после сессии" }))} />;
  }
  const data = await getOfficeData();
  if (!data) {
    return (
      <>
        <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Офис</h1>
        <p className="mt-8 text-[15px] text-text-2">Кабинет сотрудника появится здесь</p>
      </>
    );
  }
  return <OfficeView data={data} />;
}
