import { CoursesView } from "@/components/study/courses-view";
import { PerfView } from "@/components/study/perf-view";
import { StudyTabs } from "@/components/study/study-tabs";
import { TasksView } from "@/components/study/tasks-view";
import { requireUser } from "@/server/auth/session";
import { getStudyData } from "@/server/data/study";

export default async function StudyPage() {
  const user = await requireUser();
  const data = user.role === "student" ? await getStudyData() : null;
  if (!data) {
    return (
      <>
        <h1 className="text-[34px] leading-[1.15] font-medium tracking-[-.03em] max-sm:text-[28px]">Учёба</h1>
        <p className="mt-8 text-[15px] text-text-2">Кабинет сотрудника появится здесь</p>
      </>
    );
  }
  return (
    <StudyTabs
      semester={data.semester}
      views={{
        courses: <CoursesView courses={data.courses} online={data.online} />,
        tasks: <TasksView upcoming={data.upcoming} checked={data.checked} />,
        perf: <PerfView perf={data.perf} />,
      }}
    />
  );
}
