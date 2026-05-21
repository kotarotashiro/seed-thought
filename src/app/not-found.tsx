import Link from "next/link";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-accent-light flex items-center justify-center">
        <Sprout className="w-8 h-8 text-accent" />
      </div>
      <div>
        <p className="text-5xl font-bold text-text mb-3">404</p>
        <p className="text-lg font-semibold text-text mb-2">ページが見つかりません</p>
        <p className="text-sm text-text-secondary">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
      </div>
      <Link href="/">
        <Button>ホームへ戻る</Button>
      </Link>
    </div>
  );
}
