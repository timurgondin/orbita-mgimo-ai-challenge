import { TimeView } from "@/components/time/time-view";
import { requireUser } from "@/server/auth/session";
import { getTimeData } from "@/server/data/time";
import { TeachTime } from "@/components/teach/teach-time";
import { getTeachTime } from "@/server/data/teach";

export default async function TimePage() {
  const user = await requireUser();
  if (user.role === "teacher") {
    const t = await getTeachTime();
    if (t) return <TeachTime data={t} />;
  }
  const data = user.role === "student" ? await getTimeData() : null;
  if (!data) {
    return (
      <>
        <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Время</h1>
        <p className="mt-8 text-[15px] text-text-2">Кабинет сотрудника появится здесь</p>
      </>
    );
  }
  return <TimeView data={data} />;
}
