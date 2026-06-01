"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAlert, useConfirm } from "@/components/ui/DialogProvider";

interface ExportButtonProps {
  ids: string[];
  format: "zip" | "bundle";
}

export function ExportButton({ ids, format }: ExportButtonProps) {
  const confirm = useConfirm();
  const alert = useAlert();
  const [busy, setBusy] = useState(false);

  const exportNow = async () => {
    if (ids.length === 0) {
      const ok = await confirm("選択がないため、保存済みカード全件を書き出します。続行しますか？");
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, format }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "エクスポートに失敗しました");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download =
        format === "zip" ? `seedthought-${stamp}.zip` : `seedthought-${stamp}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      await alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={exportNow}
      loading={busy}
      loadingLabel="作成中..."
    >
      <Download className="mr-1.5 h-4 w-4" />
      {format === "zip" ? "ZIPで書き出す" : "1本のMDで書き出す"}
    </Button>
  );
}
