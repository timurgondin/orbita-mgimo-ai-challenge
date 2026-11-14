export interface Deadline {
  id: string;
  title: string;
  subtitle: string;
  /** ISO-дата и время, YYYY-MM-DDTHH:MM (Москва) */
  due: string;
}

export const deadlines: Deadline[] = [
  {
    id: "essay-gvc",
    title: "Эссе «Глобальные цепочки поставок»",
    subtitle: "Мировая экономика · черновик",
    due: "2026-11-19T23:59",
  },
  {
    id: "econometrics-test-2",
    title: "Контрольная №2",
    subtitle: "Эконометрика · 20% итоговой оценки",
    due: "2026-11-23T09:30",
  },
  {
    id: "micro-ps6",
    title: "Problem set 6",
    subtitle: "Микроэкономика · отправлено",
    due: "2026-11-21T18:00",
  },
  {
    id: "english-tesla",
    title: "Case study: Tesla in China",
    subtitle: "Английский язык · на проверке",
    due: "2026-11-22T23:59",
  },
];
