"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle } from "lucide-react";
import { squareJpeg } from "@/components/onboarding/photo";
import { useToast } from "@/components/ui/toast";
import { savePhoto } from "@/server/onboarding/actions";
import { cn } from "@/lib/utils";

/** Аватар профиля студента: фото или монограмма; по нажатию — выбрать новое фото. */
export function ProfilePhoto({
  photo,
  initials,
  background,
  className,
}: {
  photo: string | null;
  initials: string;
  background: string;
  className: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast, node } = useToast();
  const [pending, start] = useTransition();

  const pick = (file: File | undefined) => {
    if (!file) return;
    start(async () => {
      let blob: Blob;
      try {
        blob = await squareJpeg(file);
      } catch {
        return toast("Не получилось открыть фото", "error");
      }
      const form = new FormData();
      form.set("photo", blob, "photo.jpg");
      const r = await savePhoto(form);
      if (!r.ok) return toast(r.error, "error");
      toast("Фото обновлено");
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        aria-label={photo ? "Сменить фото" : "Добавить фото"}
        style={{ background }}
        className={cn("group relative overflow-hidden", className)}
        data-profile-photo
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- своё фото из /me/photo
          <img src={photo} alt="" className="size-full object-cover" />
        ) : (
          initials
        )}
        <span
          className={cn(
            "absolute inset-0 grid place-items-center bg-black/45 text-white transition-opacity",
            pending ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          {pending ? <LoaderCircle size={24} className="animate-spin" /> : <Camera size={24} strokeWidth={1.8} />}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {node}
    </>
  );
}
