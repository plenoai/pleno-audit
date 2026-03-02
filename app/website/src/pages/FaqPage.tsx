import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, HelpCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import Footer from '../components/Footer';

// FAQ Item Component
const FaqItem = ({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-[#eaeaea] dark:border-[#333] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left bg-white dark:bg-[#171717] hover:bg-[#fafafa] dark:hover:bg-[#1a1a1a] transition-colors"
      >
        <span className="font-medium text-[#171717] dark:text-[#ededed]">
          {question}
        </span>
        <ChevronDown
          className={`h-5 w-5 text-[#666] dark:text-[#8f8f8f] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="p-4 bg-[#fafafa] dark:bg-[#111] border-t border-[#eaeaea] dark:border-[#333]">
          <p className="text-[#666] dark:text-[#8f8f8f]">{answer}</p>
        </div>
      )}
    </div>
  );
};

// FAQ Category Component
const FaqCategory = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-4">
    <h2 className="text-xl font-medium text-[#171717] dark:text-[#ededed]">
      {title}
    </h2>
    <div className="space-y-3">{children}</div>
  </section>
);

export default function FaqPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[#eaeaea] dark:border-[#333]">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#171717] dark:text-[#ededed]" />
              <span className="font-medium text-[#171717] dark:text-[#ededed]">
                Pleno Audit
              </span>
            </Link>
            <Link
              to="/"
              className="flex items-center gap-2 text-sm text-[#666] dark:text-[#8f8f8f] hover:text-[#171717] dark:hover:text-[#ededed] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>ホームに戻る</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-12"
        >
          {/* Title */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <HelpCircle className="h-8 w-8 text-[#171717] dark:text-[#ededed]" />
              <h1 className="text-3xl font-medium text-[#171717] dark:text-[#ededed]">
                よくある質問
              </h1>
            </div>
            <p className="text-[#666] dark:text-[#8f8f8f]">
              Pleno Auditに関するよくある質問と回答をまとめました。
            </p>
          </div>

          {/* Privacy & Data */}
          <FaqCategory title="プライバシーとデータ">
            <FaqItem
              question="開発者は私のブラウジングデータやAIプロンプトを見ることができますか？"
              answer="いいえ。本拡張機能にはデータを外部に送信する機能がなく、開発者がユーザーのデータにアクセスする手段は存在しません。すべてのデータはユーザーの端末内（ブラウザのIndexedDB/SQLite）に保存され、外部サーバーに送信されることはありません。"
            />
            <FaqItem
              question="収集されたデータはどこに保存されますか？"
              answer="すべてのデータはユーザーの端末内に保存されます。本拡張機能は端末内で完結して動作するため、ブラウジングデータがインターネット経由で送信されることはありません。"
            />
            <FaqItem
              question="データを削除するにはどうすればよいですか？"
              answer="ダッシュボードの設定から、いつでもデータを削除することができます。また、拡張機能をアンインストールすると、すべてのデータが自動的に削除されます。"
            />
            <FaqItem
              question="AIプロンプトの監視とは何ですか？"
              answer="AIサービス（ChatGPT、Claude等）へのリクエストを検出し、ダッシュボードで可視化する機能です。これはセキュリティ監視のためであり、検出されたデータはユーザーの端末内にのみ保存されます。開発者を含む第三者がこのデータにアクセスすることはできません。"
            />
          </FaqCategory>

          {/* Features */}
          <FaqCategory title="機能について">
            <FaqItem
              question="この拡張機能は何をしますか？"
              answer="Pleno Auditは、ブラウザのセキュリティを可視化するChrome拡張機能です。Shadow IT（未許可SaaSサービス）の検出、フィッシングサイトの検出、CSP違反の監視、AIサービス利用の監視などの機能を提供します。"
            />
            <FaqItem
              question="悪意のあるサイトをブロックしますか？"
              answer="いいえ。本拡張機能は「検出・可視化」を目的としており、アクセスのブロックや自動的な対処は行いません。検出結果はダッシュボードで確認でき、ユーザー自身が判断・対応することを想定しています。"
            />
            <FaqItem
              question="企業で利用できますか？"
              answer="はい。個人利用だけでなく、企業・組織内でのセキュリティ可視化目的での利用も可能です。将来的には、企業向けの機能として任意のサーバー連携を追加する可能性があります。"
            />
          </FaqCategory>

          {/* Technical */}
          <FaqCategory title="技術的な質問">
            <FaqItem
              question="どのブラウザで動作しますか？"
              answer="現在はGoogle Chrome（Manifest V3対応）で動作します。Chrome互換ブラウザ（Edge、Brave等）でも動作する可能性がありますが、正式にはサポートしていません。"
            />
            <FaqItem
              question="ソースコードは公開されていますか？"
              answer="はい。本拡張機能はAGPL-3.0ライセンスの下でオープンソースとして公開されています。GitHubリポジトリからソースコードを確認、改変、再配布することができます。"
            />
            <FaqItem
              question="パフォーマンスに影響はありますか？"
              answer="本拡張機能は軽量に設計されており、通常のブラウジングに大きな影響を与えることはありません。すべての処理はローカルで行われるため、ネットワーク遅延も発生しません。"
            />
          </FaqCategory>

          {/* Links */}
          <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-[#fafafa] dark:bg-[#111] p-6">
            <p className="text-[#666] dark:text-[#8f8f8f] text-center">
              その他のご質問は、GitHubの
              <a
                href="https://github.com/plenoai/pleno-audit/discussions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0050b3] dark:text-[#60a5fa] hover:underline mx-1"
              >
                Discussions
              </a>
              をご利用ください。
              <br className="hidden md:block" />
              また、
              <Link
                to="/privacy"
                className="text-[#0050b3] dark:text-[#60a5fa] hover:underline mx-1"
              >
                プライバシーポリシー
              </Link>
              と
              <Link
                to="/terms"
                className="text-[#0050b3] dark:text-[#60a5fa] hover:underline mx-1"
              >
                利用規約
              </Link>
              もご確認ください。
            </p>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
