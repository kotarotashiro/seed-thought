"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";

interface Author {
  username: string;
  name?: string | null;
}

interface PostFiltersProps {
  genres: string[];
  authors: Author[];
  selectedGenre: string;
  selectedPostType: string;
  selectedSavedType: string;
  selectedDigestStatus: string;
  selectedSort: string;
  selectedAuthor: string;
  searchQuery: string;
  onGenreChange: (value: string) => void;
  onPostTypeChange: (value: string) => void;
  onSavedTypeChange: (value: string) => void;
  onDigestStatusChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onAuthorChange: (value: string) => void;
  onSearchChange: (value: string) => void;
}

export function PostFilters({
  genres,
  authors,
  selectedGenre,
  selectedPostType,
  selectedSavedType,
  selectedDigestStatus,
  selectedSort,
  selectedAuthor,
  searchQuery,
  onGenreChange,
  onPostTypeChange,
  onSavedTypeChange,
  onDigestStatusChange,
  onSortChange,
  onAuthorChange,
  onSearchChange,
}: PostFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const detailFilterCount = [selectedPostType, selectedSavedType, selectedAuthor].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Search */}
      <input
        type="text"
        placeholder="投稿を検索..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-text placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
      />

      {/* Primary filters */}
      <div className="flex flex-wrap gap-2">
        <div className="min-w-0 w-[calc(50%-4px)] sm:w-40">
          <Select
            value={selectedGenre}
            onChange={(e) => onGenreChange(e.target.value)}
            options={[
              { value: "", label: "すべてのジャンル" },
              ...genres.map((g) => ({ value: g, label: g })),
            ]}
          />
        </div>
        <div className="min-w-0 w-[calc(50%-4px)] sm:w-40">
          <Select
            value={selectedDigestStatus}
            onChange={(e) => onDigestStatusChange(e.target.value)}
            options={[
              { value: "", label: "すべての状態" },
              { value: "undigested", label: "未学習" },
              { value: "digested", label: "学習済み" },
            ]}
          />
        </div>
        <div className="min-w-0 w-[calc(50%-4px)] sm:w-44">
          <Select
            value={selectedSort}
            onChange={(e) => onSortChange(e.target.value)}
            options={[
              { value: "likedAt_desc", label: "いいねした日が新しい順" },
              { value: "likedAt_asc", label: "いいねした日が古い順" },
              { value: "savedAt_desc", label: "アプリ取り込み日が新しい順" },
              { value: "savedAt_asc", label: "アプリ取り込み日が古い順" },
              { value: "postedAt_desc", label: "投稿日が新しい順" },
              { value: "postedAt_asc", label: "投稿日が古い順" },
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
            expanded || detailFilterCount > 0
              ? "border-accent bg-accent-subtle text-accent"
              : "border-border bg-white text-text-secondary hover:border-accent/40 hover:text-text"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          詳細フィルタ
          {detailFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
              {detailFilterCount}
            </span>
          )}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Detail filters */}
      {expanded && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-border-light bg-border-light/40 p-3">
          <div className="min-w-0 w-[calc(50%-4px)] sm:w-40">
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
          <div className="min-w-0 w-[calc(50%-4px)] sm:w-40">
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
          {authors.length > 0 && (
            <div className="min-w-0 w-full sm:w-48">
              <Select
                value={selectedAuthor}
                onChange={(e) => onAuthorChange(e.target.value)}
                options={[
                  { value: "", label: "すべての投稿者" },
                  ...authors.map((a) => ({
                    value: a.username,
                    label: a.name ? `${a.name} (@${a.username})` : `@${a.username}`,
                  })),
                ]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
