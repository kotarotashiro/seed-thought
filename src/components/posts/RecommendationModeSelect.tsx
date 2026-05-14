"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { RefreshCw } from "lucide-react";

interface RecommendationModeSelectProps {
  mode: string;
  genres: string[];
  selectedGenre: string;
  onModeChange: (mode: string) => void;
  onGenreChange: (genre: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export function RecommendationModeSelect({
  mode,
  genres,
  selectedGenre,
  onModeChange,
  onGenreChange,
  onRefresh,
  loading,
}: RecommendationModeSelectProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-48">
        <Select
          label="候補選定モード"
          value={mode}
          onChange={(e) => onModeChange(e.target.value)}
          options={[
            { value: "latest", label: "最新から" },
            { value: "random", label: "完全ランダム" },
            { value: "genre", label: "ジャンル指定ランダム" },
            { value: "undigested", label: "未消化から" },
          ]}
        />
      </div>

      {mode === "genre" && (
        <div className="w-48">
          <Select
            label="ジャンル"
            value={selectedGenre}
            onChange={(e) => onGenreChange(e.target.value)}
            options={[
              { value: "", label: "選択してください" },
              ...genres.map((g) => ({ value: g, label: g })),
            ]}
          />
        </div>
      )}

      <Button
        variant="secondary"
        onClick={onRefresh}
        disabled={loading}
        className="gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        候補を引き直す
      </Button>
    </div>
  );
}
