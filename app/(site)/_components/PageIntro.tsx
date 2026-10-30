// Page heading plus one-line intro, tight as in the mockups (4px between).
export function PageIntro({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[22px] font-extrabold md:text-[32px] md:tracking-[-0.01em]">{title}</h1>
      <p className="max-w-[65ch] text-base leading-normal text-muted">{children}</p>
    </div>
  );
}
