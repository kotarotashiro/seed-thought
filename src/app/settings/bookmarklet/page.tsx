"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Bookmark, Copy, CheckCircle } from "lucide-react";

const STORAGE_KEY_BASE = "seedthought.bookmarklet.apiBase";
const STORAGE_KEY_TOKEN = "seedthought.bookmarklet.token";

function buildBookmarklet(apiBase: string, token: string): string {
  const cleanBase = apiBase.replace(/\/$/, "");
  const js = `(()=>{var A=${JSON.stringify(cleanBase)},T=${JSON.stringify(token)},u=location.href;if(!/(?:x|twitter)\\.com\\/i\\/article\\//i.test(u)){alert('X Articleページで実行してください');return}var om=function(p){var e=document.querySelector('meta[property="'+p+'"]')||document.querySelector('meta[name="'+p+'"]');return e?(e.getAttribute('content')||'').trim()||null:null};var cp=function(t){return(t||'').replace(/\\r\\n/g,'\\n').replace(/\\r/g,'\\n').replace(/[ \\t]+/g,' ').replace(/\\n{3,}/g,'\\n\\n').trim()};var ti=om('og:title')||(document.querySelector('h1')&&document.querySelector('h1').innerText.trim())||(document.title||'').replace(/\\s*[|\\-–—].*$/,'').trim()||null;var b=null;var S=["[data-testid='article']","article","[role='article']","main","[role='main']"];for(var i=0;i<S.length;i++){var el=document.querySelector(S[i]);if(!el)continue;var c=el.cloneNode(true);var ns=c.querySelectorAll("nav,aside,footer,[aria-label='Trending'],[data-testid='sidebarColumn']");for(var j=0;j<ns.length;j++)ns[j].remove();var t=cp(c.innerText||'');if(t.length>=100){b=t;break}}if(!b){var od=om('og:description');if(od&&od.length>=100)b=od}if(!b||b.length<100){alert('本文が短すぎます（'+(b?b.length:0)+'文字）。ページ読込中の可能性があります');return}var h={'Content-Type':'application/json'};if(T)h['x-extension-token']=T;fetch(A+'/api/x/article-body',{method:'POST',headers:h,body:JSON.stringify({articleUrl:u,title:ti,body:b})}).then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d}})}).then(function(x){alert(x.ok?'保存しました\\n'+(ti||'(タイトルなし)'):'エラー: '+(x.d.error||'unknown'))}).catch(function(e){alert('通信エラー: '+e.message)})})();`;
  return "javascript:" + encodeURIComponent(js);
}

export default function BookmarkletPage() {
  const [apiBase, setApiBase] = useState("");
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const savedBase = localStorage.getItem(STORAGE_KEY_BASE);
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    setApiBase(savedBase ?? window.location.origin);
    setToken(savedToken ?? "");
  }, []);

  useEffect(() => {
    if (apiBase) localStorage.setItem(STORAGE_KEY_BASE, apiBase);
  }, [apiBase]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
  }, [token]);

  const bookmarklet = useMemo(() => buildBookmarklet(apiBase, token), [apiBase, token]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // older browsers
      const ta = document.createElement("textarea");
      ta.value = bookmarklet;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
      <div className="flex items-start gap-3 sm:items-center">
        <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
          <Bookmark className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text sm:text-2xl">ブックマークレット</h1>
          <p className="text-sm text-text-secondary">
            スマホで X Article 本文を取得するためのブックマーク
          </p>
        </div>
      </div>

      <Card>
        <h3 className="text-base font-bold text-text mb-4">設定</h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text">
              API ベース URL
            </label>
            <input
              type="url"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="https://your-host.example.com"
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
            <p className="text-xs text-text-muted">
              スマホからアクセス可能な URL を入れてください（VPN 経由の localhost / Vercel など）。
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text">
              Extension トークン（任意）
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="EXTENSION_TOKEN を設定している場合のみ"
              className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
            <p className="text-xs text-text-muted">
              サーバの環境変数 EXTENSION_TOKEN を設定している場合のみ入力。
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-bold text-text mb-4">ブックマークレット</h3>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-bg p-3">
            <a
              href={bookmarklet}
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              <Bookmark className="w-4 h-4" />
              X Article 取得
            </a>
            <p className="mt-2 text-xs text-text-muted">
              PC: 上のリンクをブックマークバーにドラッグ
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text">
              スマホ用: 下のテキストをコピー
            </label>
            <textarea
              readOnly
              value={bookmarklet}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-xs text-text font-mono break-all"
              rows={5}
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button onClick={handleCopy} variant="secondary" size="sm">
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  コピー済み
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  コピー
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-base font-bold text-text mb-4">セットアップ手順（スマホ）</h3>
        <div className="space-y-4 text-sm text-text-secondary">
          <div>
            <p className="font-medium text-text mb-1">iOS Safari</p>
            <ol className="list-decimal list-inside space-y-1 pl-2">
              <li>このページを Safari で開き、共有メニューから「ブックマークを追加」</li>
              <li>ブックマーク一覧でそのブックマークを「編集」</li>
              <li>名前を「X Article 取得」などに変更</li>
              <li>URL 欄に、上でコピーしたテキストを貼り付け（既存の URL は削除）</li>
              <li>保存</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-text mb-1">Android Chrome</p>
            <ol className="list-decimal list-inside space-y-1 pl-2">
              <li>Chrome で適当なページをブックマーク</li>
              <li>「ブックマーク」→「モバイルのブックマーク」で編集</li>
              <li>URL 欄に上のテキストを貼り付け、名前を「X Article 取得」に変更</li>
              <li>使用時はアドレスバーに「X Article 取得」と入力するとサジェストに出ます</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-text mb-1">使い方</p>
            <ol className="list-decimal list-inside space-y-1 pl-2">
              <li>X アプリではなく Safari/Chrome で X.com を開き、Article ページに移動</li>
              <li>記事が表示されたらブックマークレットを実行</li>
              <li>「保存しました」のアラートが出れば成功</li>
            </ol>
          </div>
        </div>
      </Card>
    </div>
  );
}
