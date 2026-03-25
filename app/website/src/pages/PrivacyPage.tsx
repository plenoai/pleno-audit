import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Lock, Eye, Database, Trash2, Mail } from 'lucide-react';
import Footer from '../components/Footer';

// Section Component
const Section = ({
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
    <div className="text-[#666] dark:text-[#8f8f8f] space-y-3">
      {children}
    </div>
  </section>
);

// Info Card Component
const InfoCard = ({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) => (
  <div className="flex items-start gap-4 p-4 rounded-lg bg-[#fafafa] dark:bg-[#111] border border-[#eaeaea] dark:border-[#333]">
    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-white dark:bg-[#171717] border border-[#eaeaea] dark:border-[#333] flex-shrink-0">
      <Icon className="h-5 w-5 text-[#171717] dark:text-[#ededed]" />
    </div>
    <div>
      <h3 className="font-medium text-[#171717] dark:text-[#ededed] mb-1">
        {title}
      </h3>
      <p className="text-sm text-[#666] dark:text-[#8f8f8f]">
        {description}
      </p>
    </div>
  </div>
);

export default function PrivacyPage() {
  const lastUpdated = '2026年3月26日';

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
            <h1 className="text-3xl font-medium text-[#171717] dark:text-[#ededed]">
              プライバシーポリシー
            </h1>
            <p className="text-[#666] dark:text-[#8f8f8f]">
              最終更新日: {lastUpdated}
            </p>
          </div>

          {/* Introduction */}
          <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-[#fafafa] dark:bg-[#111] p-6">
            <p className="text-[#666] dark:text-[#8f8f8f]">
              Pleno Audit（以下「本拡張機能」）は、ユーザーのプライバシーを最優先に設計されています。
              本プライバシーポリシーでは、本拡張機能がどのようにデータを収集、使用、保護するかについて説明します。
            </p>
          </div>

          {/* Key Points */}
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard
              icon={Lock}
              title="端末内完結"
              description="すべてのデータは端末内に保存され、外部サーバーへの送信は行いません。"
            />
            <InfoCard
              icon={Eye}
              title="透明性"
              description="収集するデータの種類と目的を明確に開示しています。"
            />
            <InfoCard
              icon={Database}
              title="最小限のデータ"
              description="機能の提供に必要な最小限のデータのみを収集します。"
            />
            <InfoCard
              icon={Trash2}
              title="完全な削除"
              description="拡張機能のアンインストール時にすべてのデータが削除されます。"
            />
          </div>

          {/* Sections */}
          <Section title="1. 収集するデータ">
            <p>本拡張機能は、セキュリティ監視機能を提供するため、以下のデータを端末内に記録します</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong>ネットワーク通信:</strong> URL、ドメイン、リクエスト/レスポンス内容（fetch/XHR hook）
              </li>
              <li>
                <strong>Cookie:</strong> 名前、ドメイン、有効期限
              </li>
              <li>
                <strong>ページ情報:</strong> DOM解析によるフォームやリンクの検出結果
              </li>
            </ul>
          </Section>

          <Section title="2. データの保存場所">
            <p>
              収集したすべてのデータは、ユーザーの端末内（ブラウザのIndexedDB/SQLite）に保存されます。
              データは外部サーバーに送信されることはありません。
              開発者およびいかなる第三者も、ユーザーの端末に保存されたデータにアクセスする手段を持ちません。
            </p>
            <div className="rounded-lg bg-[#d3f9d8] dark:bg-[#0a3d1a] border border-[#b8f0c0] dark:border-[#166534] p-4 mt-4">
              <p className="text-[#0a7227] dark:text-[#4ade80] text-sm">
                <strong>重要:</strong> 本拡張機能は端末内で完結して動作します。
                ブラウジングデータがインターネット経由で送信されることはありません。
              </p>
            </div>
          </Section>

          <Section title="3. データの利用目的">
            <p>収集したデータは、以下の目的でのみ使用されます</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>セキュリティイベントの検出と可視化</li>
              <li>ダッシュボードでの統計情報の表示</li>
              <li>ユーザーへのセキュリティアラートの提供</li>
            </ul>
          </Section>

          <Section title="4. データの共有">
            <p>
              本拡張機能は、収集したデータを第三者と共有することはありません。
              すべてのデータはユーザーの端末内に留まります。
            </p>
          </Section>

          <Section title="5. データの保持期間">
            <p>
              データは、ユーザーが明示的に削除するか、拡張機能をアンインストールするまで保持されます。
              ダッシュボードの設定から、いつでもデータを削除することができます。
            </p>
          </Section>

          <Section title="6. ユーザーの権利">
            <p>ユーザーは以下の権利を有します</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong>アクセス権:</strong> ダッシュボードから収集されたすべてのデータを閲覧できます
              </li>
              <li>
                <strong>削除権:</strong> いつでもデータを削除できます
              </li>
              <li>
                <strong>オプトアウト:</strong> 拡張機能をアンインストールすることで、データ収集を完全に停止できます
              </li>
            </ul>
          </Section>

          <Section title="7. セキュリティ対策">
            <p>
              本拡張機能は、Chrome Manifest V3の最新のセキュリティ基準に準拠しています。
              データはブラウザのセキュアなストレージ（IndexedDB）に保存され、
              他のウェブサイトやアプリケーションからアクセスすることはできません。
            </p>
          </Section>

          <Section title="8. 将来のサーバー連携について">
            <p>
              将来的に、企業向けの機能として任意のサーバー連携を追加する可能性があります。
              この場合、サーバーに送信されるデータの種類と目的を明確に開示し、
              ユーザーの明示的な同意を得た上でのみデータを送信します。
            </p>
          </Section>

          <Section title="9. プライバシーポリシーの変更">
            <p>
              本プライバシーポリシーは、必要に応じて更新されることがあります。
              重要な変更がある場合は、拡張機能内で通知します。
            </p>
          </Section>

          <Section title="10. お問い合わせ">
            <p>
              プライバシーに関するご質問やご懸念がある場合は、以下の方法でお問い合わせください
            </p>
            <div className="flex items-center gap-2 mt-4 p-4 rounded-lg bg-[#fafafa] dark:bg-[#111] border border-[#eaeaea] dark:border-[#333]">
              <Mail className="h-5 w-5 text-[#666] dark:text-[#8f8f8f]" />
              <span>GitHubのIssueまたはDiscussionsをご利用ください</span>
            </div>
          </Section>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
