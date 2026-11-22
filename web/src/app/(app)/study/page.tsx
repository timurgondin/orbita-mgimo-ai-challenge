import { CoursesView } from "@/components/study/courses-view";
import { PerfView } from "@/components/study/perf-view";
import { StudyTabs } from "@/components/study/study-tabs";
import { TasksView } from "@/components/study/tasks-view";
import { requireUser } from "@/server/auth/session";
import { getArchive } from "@/server/data/archive";
import { getStudyData } from "@/server/data/study";
import { GradebookView } from "@/components/teach/gradebook";
import { ReviewView } from "@/components/teach/review-view";
import { TeachCourses, TeachStudy } from "@/components/teach/teach-study";
import { getGradebook, getReview, getTeachCourses } from "@/server/data/teach";

async function TeacherStudy() {
  const [courses, review] = await Promise.all([getTeachCourses(), getReview()]);
  if (!courses || !review) return null;
  const books = (await Promise.all(courses.map((c) => getGradebook(c.slug)))).flatMap((b) => (b ? [b.book] : []));
  return (
    <TeachStudy
      toReview={review.waiting.length}
      views={{
        courses: <TeachCourses courses={courses} />,
        review: <ReviewView courses={review.courses} waiting={review.waiting} checked={review.checked} />,
        journal: <GradebookView books={books} courses={review.courses} />,
      }}
    />
  );
}

export default async function StudyPage() {
  const user = await requireUser();
  if (user.role === "teacher") {
    const teacher = await TeacherStudy();
    if (teacher) return teacher;
  }
  const [data, archive] = user.role === "student" ? await Promise.all([getStudyData(), getArchive()]) : [null, null];
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
      views={{
        courses: <CoursesView courses={data.courses} online={data.online} past={archive?.semesters} />,
        tasks: <TasksView upcoming={data.upcoming} waiting={data.waiting} later={data.later} checked={data.checked} />,
        perf: <PerfView perf={data.perf} past={archive?.semesters} />,
      }}
    />
  );
}
