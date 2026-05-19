"use client";

import { Select } from "@/components/ui/Select";

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
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <div className="min-w-0 sm:w-40">
          <Select
            value={selectedGenre}
            onChange={(e) => onGenreChange(e.target.value)}
            options={[
              { value: "", label: "すべてのジャンル" },
              ...genres.map((g) => ({ value: g, label: g })),
            ]}
          />
        </div>
        <div className="min-w-0 sm:w-40">
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
        <div className="min-w-0 sm:w-40">
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
        <div className="min-w-0 sm:w-40">
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
        {authors.length > 0 && (
          <div className="min-w-0 sm:w-48">
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
        <div className="col-span-2 min-w-0 sm:col-span-1 sm:w-44">
          <Select
            value={selectedSort}
            onChange={(e) => onSortChange(e.target.value)}
            options={[
              { value: "savedAt_desc", label: "保存日が新しい順" },
              { value: "savedAt_asc", label: "保存日が古い順" },
              { value: "postedAt_desc", label: "投稿日が新しい順" },
              { value: "postedAt_asc", label: "投稿日が古い順" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
