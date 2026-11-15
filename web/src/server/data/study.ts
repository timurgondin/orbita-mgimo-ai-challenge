import "server-only";
import { db } from "@/server/db/client";
import { DEMO_NOW, formatDayMonth, formatMonthShort, mskDate, mskTime, semesterLabel } from "@/lib/demo-clock";
import {
  avatarGradientByKey,
  currentScore,
  fmt1,
  fmtWork,
  formatDue,
  getStudent,
  lowerFirst,
  teacherInitials,
} from "./shared";
import {
  TASK_KINDS,
  type ComponentKind,
  type CourseCardData,
  type ExamData,
  type FormulaSegment,
  type PerfRowData,
  type StudyData,
  type TagKind,
  type TaskItemData,
  type WorkStatus,
} from "./types";

const CREDITS_PLAN = 30;
/** «Ближайшие» — задания со сроком в пределах 10 суток. */
const UPCOMING_DAYS = 10;

/** Всё для экрана «Учёба» текущего студента. Только его записи на курсы и его работы. */
export async function getStudyData(): Promise<StudyData | null> {
  const user = await getStudent();
  if (!user) return null;

  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id },
    orderBy: { order: "asc" },
    include: {
      course: {
        include: {
          components: {
            orderBy: { order: "asc" },
            include: { works: { where: { userId: user.id } } },
          },
          onlineProgress: { where: { userId: user.id } },
        },
      },
    },
  });

  const now = DEMO_NOW;
  const courses: CourseCardData[] = [];
  const online: CourseCardData[] = [];
  const upcoming: (TaskItemData & { at: number })[] = [];
  const checked: (TaskItemData & { at: number })[] = [];
  const rows: PerfRowData[] = [];
  const exams: (ExamData & { at: number })[] = [];
  const examScores: { score: number; credits: number }[] = [];

  for (const { course } of enrollments) {
    const items = course.components.map((c) => ({ c, work: c.works[0] }));

    if (course.format === "online") {
      const p = course.onlineProgress[0];
      const total = course.lessonsTotal ?? 0;
      online.push({
        id: course.id,
        color: course.color,
        kindLabel: `Видеокурс · ${total} уроков`,
        title: course.title,
        teacher: course.providerName ?? course.teacherName,
        score: String(p?.lessonsDone ?? 0),
        scoreSuffix: `из ${total}`,
        nextTitle: p?.nextLessonTitle ?? null,
        nextWhen: p ? `${p.nextLessonMinutes} мин` : null,
        formula: [],
        progress: total ? Math.round(((p?.lessonsDone ?? 0) / total) * 100) : 0,
      });
      continue;
    }

    const score = currentScore(items.map(({ c, work }) => ({ weight: c.weight, work })));
    const formula: FormulaSegment[] = items.map(({ c, work }) => ({
      weight: c.weight,
      state: work?.status === "graded" ? "done" : work && work.status !== "upcoming" ? "pending" : "empty",
    }));

    // Ближайшее событие: самый ранний ещё не проверенный компонент со сроком
    const next = items
      .filter(({ c, work }) => c.dueAt && c.dueAt >= now && work?.status !== "graded")
      .sort((a, b) => a.c.dueAt!.getTime() - b.c.dueAt!.getTime())[0];
    const nextDue = next && formatDue(next.c.dueAt!);

    const isExam = course.assessment === "exam";
    courses.push({
      id: course.id,
      color: course.color,
      kindLabel: course.kindsLabel,
      title: course.title,
      teacher: course.teacherName,
      score: isExam ? (score != null ? fmt1(score) : "—") : "Зачёт",
      scoreSuffix: isExam && score != null ? "из 10" : "",
      nextTitle: next ? next.c.shortTitle ?? next.c.title : null,
      nextWhen: nextDue ? (nextDue.label.includes(",") ? lowerFirst(nextDue.label) : nextDue.label) : null,
      formula,
    });

    // Задания
    for (const { c, work } of items) {
      if (!(TASK_KINDS as ComponentKind[]).includes(c.kind as ComponentKind)) continue;
      const status = (work?.status ?? "upcoming") as WorkStatus;
      if (status === "graded") {
        checked.push({
          id: c.id,
          color: course.color,
          title: c.title,
          subtitle: `${course.title} · ${work?.gradedAt ? formatDayMonth(work.gradedAt) : ""}`,
          due: "",
          dueHot: false,
          status: null,
          score: work?.score != null ? fmtWork(work.score) : undefined,
          feedback: work?.feedback
            ? {
                text: work.feedback,
                initials: teacherInitials(work.feedbackAuthor ?? course.teacherName),
                gradient: avatarGradientByKey(course.teacherAvatar),
              }
            : undefined,
          at: work?.gradedAt?.getTime() ?? 0,
        });
      } else if (c.dueAt && c.dueAt.getTime() < now.getTime() + UPCOMING_DAYS * 86_400_000) {
        const due = formatDue(c.dueAt);
        upcoming.push({
          id: c.id,
          color: course.color,
          title: c.title,
          subtitle: `${course.title} · ${c.subtitle ?? `${c.weight}% оценки`}`,
          due: due.label,
          dueHot: due.today,
          status: status as TagKind,
          at: c.dueAt.getTime(),
        });
      }
    }

    // Успеваемость
    if (isExam) {
      const rounded = score;
      if (rounded != null) examScores.push({ score: rounded, credits: course.credits });
      rows.push({
        id: course.id,
        color: course.color,
        title: course.title,
        sub: "Экзамен",
        fill: rounded != null ? Math.round(rounded * 10) : 0,
        value: rounded != null ? fmt1(rounded) : "—",
        valueMuted: false,
        forecast: rounded != null ? String(Math.round(rounded)) : "",
      });
    } else {
      const graded = items.filter((i) => i.work?.status === "graded");
      const gradedWeight = graded.reduce((s, i) => s + i.c.weight, 0);
      rows.push({
        id: course.id,
        color: course.color,
        title: course.title,
        sub: "Зачёт",
        fill: gradedWeight,
        value: "идёт",
        valueMuted: true,
        forecast: `${graded.length} из ${items.length} работ`,
      });
    }

    for (const { c } of items) {
      if (c.kind === "exam" && c.dueAt && c.dueAt >= now) {
        exams.push({
          id: c.id,
          day: mskDate(c.dueAt).slice(8).replace(/^0/, ""),
          month: formatMonthShort(c.dueAt),
          title: course.title,
          sub: ["Экзамен", mskTime(c.dueAt), c.room ? `ауд. ${c.room}` : null].filter(Boolean).join(" · "),
          at: c.dueAt.getTime(),
        });
      }
    }
  }

  const credits = examScores.reduce((s, e) => s + e.credits, 0);
  const average = credits ? fmt1(Math.round((examScores.reduce((s, e) => s + e.score * e.credits, 0) / credits) * 10) / 10) : "—";

  return {
    semester: semesterLabel(),
    courses,
    online,
    upcoming: upcoming.sort((a, b) => a.at - b.at),
    checked: checked.sort((a, b) => b.at - a.at),
    perf: {
      average,
      rank: user.courseRank,
      size: user.courseSize,
      credits: user.creditsEarned,
      creditsPlan: CREDITS_PLAN,
      rows,
      exams: exams.sort((a, b) => a.at - b.at),
    },
  };
}
