import { OfficeView } from "@/components/office/office-view";
import { getOfficeData } from "@/server/data/office";

export default async function OfficePage() {
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
