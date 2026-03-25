import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, FileText, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
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

// Highlight Box Component
const HighlightBox = ({
  type,
  children,
}: {
  type: 'info' | 'warning' | 'success';
  children: React.ReactNode;
}) => {
  const styles = {
    info: {
      bg: 'bg-[#e6f4ff] dark:bg-[#0a2a3d]',
      border: 'border-[#91caff] dark:border-[#1e40af]',
      text: 'text-[#0050b3] dark:text-[#60a5fa]',
      icon: AlertCircle,
    },
    warning: {
      bg: 'bg-[#fff8e6] dark:bg-[#3d2e0a]',
      border: 'border-[#ffe58f] dark:border-[#92400e]',
      text: 'text-[#915b00] dark:text-[#fbbf24]',
      icon: AlertCircle,
    },
    success: {
      bg: 'bg-[#d3f9d8] dark:bg-[#0a3d1a]',
      border: 'border-[#b8f0c0] dark:border-[#166534]',
      text: 'text-[#0a7227] dark:text-[#4ade80]',
      icon: CheckCircle,
    },
  };

  const style = styles[type];
  const Icon = style.icon;

  return (
    <div className={`rounded-lg ${style.bg} border ${style.border} p-4 flex items-start gap-3`}>
      <Icon className={`h-5 w-5 ${style.text} flex-shrink-0 mt-0.5`} />
      <div className={`${style.text} text-sm`}>{children}</div>
    </div>
  );
};

// List Item Component
const ListItem = ({
  allowed,
  children,
}: {
  allowed: boolean;
  children: React.ReactNode;
}) => (
  <li className="flex items-start gap-3">
    {allowed ? (
      <CheckCircle className="h-5 w-5 text-[#0a7227] dark:text-[#4ade80] flex-shrink-0 mt-0.5" />
    ) : (
      <XCircle className="h-5 w-5 text-[#c00] dark:text-[#f87171] flex-shrink-0 mt-0.5" />
    )}
    <span>{children}</span>
  </li>
);

export default function TermsPage() {
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
              利用規約
            </h1>
            <p className="text-[#666] dark:text-[#8f8f8f]">
              最終更新日: {lastUpdated}
            </p>
          </div>

          {/* Introduction */}
          <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-[#fafafa] dark:bg-[#111] p-6">
            <div className="flex items-start gap-4">
              <FileText className="h-6 w-6 text-[#171717] dark:text-[#ededed] flex-shrink-0" />
              <p className="text-[#666] dark:text-[#8f8f8f]">
                本利用規約（以下「本規約」）は、Pleno Audit（以下「本拡張機能」）の利用条件を定めるものです。
                本拡張機能をインストールまたは使用することにより、ユーザーは本規約に同意したものとみなされます。
              </p>
            </div>
          </div>

          {/* Sections */}
          <Section title="第1条（定義）">
            <p>本規約において使用する用語の定義は以下のとおりです</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong>「本拡張機能」:</strong> Pleno Audit Chrome拡張機能およびその関連サービス
              </li>
              <li>
                <strong>「ユーザー」:</strong> 本拡張機能をインストールまたは使用する個人または法人
              </li>
              <li>
                <strong>「サービス」:</strong> 本拡張機能が提供するセキュリティ監視・可視化機能
              </li>
            </ul>
          </Section>

          <Section title="第2条（サービスの内容）">
            <p>本拡張機能は、以下のサービスを提供します</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Shadow IT（未許可SaaSサービス）の検出と可視化</li>
              <li>Content Security Policy（CSP）違反の監視</li>
              <li>フィッシングサイト・悪意あるドメインの検出</li>
              <li>AIサービスへのプロンプト送信の監視</li>
              <li>認証フロー（OAuth/SAML）の検出</li>
              <li>セキュリティイベントの一元管理ダッシュボード</li>
            </ul>
            <HighlightBox type="info">
              本拡張機能は「検出・可視化」を目的としており、
              アクセスのブロックや自動的な対処は行いません。
            </HighlightBox>
          </Section>

          <Section title="第3条（利用条件）">
            <p>ユーザーは、以下の条件に同意の上、本拡張機能を利用するものとします</p>
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="font-medium text-[#171717] dark:text-[#ededed] mb-2">許可される利用</h4>
                <ul className="space-y-2">
                  <ListItem allowed={true}>個人的なセキュリティ監視目的での利用</ListItem>
                  <ListItem allowed={true}>企業・組織内でのセキュリティ可視化目的での利用</ListItem>
                  <ListItem allowed={true}>セキュリティ教育・研究目的での利用</ListItem>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-[#171717] dark:text-[#ededed] mb-2">禁止される利用</h4>
                <ul className="space-y-2">
                  <ListItem allowed={false}>他者のプライバシーを侵害する目的での利用</ListItem>
                  <ListItem allowed={false}>不正アクセスやハッキングを目的とした利用</ListItem>
                </ul>
              </div>
            </div>
          </Section>

          <Section title="第4条（免責事項）">
            <HighlightBox type="warning">
              <strong>重要:</strong> 以下の免責事項をご確認ください。
            </HighlightBox>
            <div className="mt-4 space-y-3">
              <p>
                1. 本拡張機能は「現状有姿」で提供されます。
                開発者は、本拡張機能の完全性、正確性、信頼性について保証しません。
              </p>
              <p>
                2. 開発者の故意または重大な過失による場合を除き、本拡張機能の使用によって生じた損害について、
                開発者は責任を負いません。
              </p>
              <p>
                3. 本拡張機能は、すべてのセキュリティ脅威を検出することを保証するものではありません。
                本拡張機能を使用しても、追加のセキュリティ対策が必要です。
              </p>
              <p>
                4. 本拡張機能の検出結果に基づく判断や行動は、ユーザー自身の責任において行ってください。
              </p>
            </div>
          </Section>

          <Section title="第5条（ライセンス）">
            <p>
              本拡張機能は、GNU Affero General Public License v3.0（AGPL-3.0）の下で提供されています。
              ユーザーは、AGPL-3.0の条件に従い、本拡張機能のソースコードの閲覧、改変、再配布を行うことができます。
            </p>
            <HighlightBox type="info">
              AGPL-3.0ライセンスの全文は、GitHubリポジトリのLICENSEファイルをご確認ください。
            </HighlightBox>
          </Section>

          <Section title="第6条（サービスの変更・終了）">
            <p>
              開発者は、事前の通知なく、本拡張機能の内容を変更、または提供を終了することができます。
              サービスの変更・終了によってユーザーに生じた損害について、開発者は責任を負いません。
            </p>
          </Section>

          <Section title="第7条（プライバシー）">
            <p>
              ユーザーの個人情報およびブラウジングデータの取り扱いについては、
              別途定める
              <Link to="/privacy" className="text-[#0050b3] dark:text-[#60a5fa] hover:underline mx-1">
                プライバシーポリシー
              </Link>
              に従います。
            </p>
            <HighlightBox type="success">
              本拡張機能は端末内で完結して動作し、
              すべてのデータはユーザーの端末内に保存されます。
            </HighlightBox>
          </Section>

          <Section title="第8条（規約の変更）">
            <p>
              開発者は、必要に応じて本規約を変更することができます。
              重要な変更については14日前までに本拡張機能内または関連ウェブサイトで通知します。
              通知後の継続利用をもって、変更後の規約に同意したものとみなします。
            </p>
          </Section>

          <Section title="第9条（準拠法・管轄）">
            <p>
              本規約は、日本法に準拠し解釈されます。
              本規約に関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </Section>

          <Section title="第10条（お問い合わせ）">
            <p>
              本規約に関するお問い合わせは、GitHubのIssueまたはDiscussionsをご利用ください。
            </p>
          </Section>

          {/* Agreement Notice */}
          <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
            <p className="text-[#666] dark:text-[#8f8f8f] text-center">
              本拡張機能をインストールまたは使用することにより、
              <br className="hidden md:block" />
              ユーザーは本利用規約および
              <Link to="/privacy" className="text-[#0050b3] dark:text-[#60a5fa] hover:underline mx-1">
                プライバシーポリシー
              </Link>
              に同意したものとみなされます。
            </p>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
