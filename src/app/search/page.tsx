import { redirect } from "next/navigation";

// /search は /chat?mode=search に統合されました。
// ブックマーク等からのアクセスも自動で検索モードに遷移します。
export default function SearchPage() {
  redirect("/chat?mode=search");
}
