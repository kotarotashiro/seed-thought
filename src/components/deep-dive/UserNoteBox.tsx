"use client";

import { Textarea } from "@/components/ui/Textarea";

interface UserNoteBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  highlighted?: boolean;
}

export function UserNoteBox({
  value,
  onChange,
  placeholder = "自由にメモを書いてください（任意）",
  highlighted = false,
}: UserNoteBoxProps) {
  return (
    <div
      className={
        highlighted
          ? "bg-accent-subtle rounded-2xl p-5 border-2 border-accent/20"
          : ""
      }
    >
      {highlighted && (
        <p className="text-sm font-medium text-accent mb-2">
          ✍️ ここが一番大事なステップです。自分の言葉で書いてみましょう。
        </p>
      )}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={highlighted ? "min-h-[160px] border-accent/30" : "min-h-[100px]"}
      />
    </div>
  );
}
