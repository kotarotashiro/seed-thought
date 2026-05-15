"use client";

import { Select } from "@/components/ui/Select";

interface PostFiltersProps {
  genres: string[];
  selectedGenre: string;
  selectedPostType: string;
  selectedSavedType: string;
  selectedDigestStatus: string;
  selectedSort: string;
  searchQuery: string;
  onGenreChange: (value: string) => void;
  onPostTypeChange: (value: string) => void;
  onSavedTypeChange: (value: string) => void;
  onDigestStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onSearchChange: (value: string) => void;
}

export function PostFilters({
  genres,
  selectedGenre,
  selectedPostType,
  selectedSavedType,
  selectedDigestStatus,
  selectedSort,
  searchQuery,
  onGenreChange,
  onPostTypeChange,
  onSavedTypeChange,
  onDigestStatusChange,
  onSortChange,
  onSearchChange,
}: PostFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder="投稿を検索..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-text placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-40">
          <Select
            value={selectedGenre}
            onChange={(e) => onGenreChange(e.target.value)}
            options={[
              { value: "", label: "すべてのジャンル" },
              ...genres.map((g) => ({ value: g, label: g })),
            ]}
          />
        </div>
        <div className="w-40">
          <Select
            value={selectedPostType}
            onChange={(e) => onPostTypeChange(e.target.value)}
            options={[
              { value: "", label: "すべてのタイプ" },
              { value: "thought", label: "思考系" },
              { value: "learning", label: "学習系" },
              { value: "output_material", label: "発信素材系" },
              { value: "unknown", label: "未分類" },
            ]}
          />
        </div>
        <div className="w-40">
          <Select
            value={selectedSavedType}
            onChange={(e) => onSavedTypeChange(e.target.value)}
            options={[
              { value: "", label: "すべての保存元" },
              { value: "like", label: "Xいいね" },
              { value: "bookmark", label: "Xブックマーク" },
              { value: "manual", label: "手動" },
            ]}
          />
        </div>
        <div className="w-40">
          <Select
            value={selectedDigestStatus}
            onChange={(e) => onDigestStatusChange(e.target.value)}
            options={[
              { value: "", label: "すべての状態" },
              { value: "undigested", label: "未消化" },
              { value: "digested", label: "深掘り済み" },
            ]}
          />
        </div>
        <div className="w-44">
          <Select
            value={selectedSort}
            onChange={(e) => onSortChange(e.target.value)}
            options={[
              { value: "postedAt_desc", label: "投稿日が新しい順" },
              { value: "postedAt_asc", label: "投稿日が古い順" },
              { value: "savedAt_desc", label: "保存日が新しい順" },
              { value: "savedAt_asc", label: "保存日が古い順" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
