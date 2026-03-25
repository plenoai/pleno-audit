import { motion } from 'framer-motion';
import { Shield, Lock, ArrowRight, Eye, AlertTriangle, Zap, Chrome, Github, Star } from 'lucide-react';
import Footer from '../components/Footer';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

const GITHUB_URL = 'https://github.com/plenoai/pleno-audit';

// Button Component
const Button = ({
  variant = 'primary',
  size = 'medium',
  children,
  suffix,
  onClick,
  to,
}: {
  variant?: 'primary' | 'secondary';
  size?: 'medium' | 'large';
  children: React.ReactNode;
  suffix?: React.ReactNode;
  onClick?: () => void;
  to?: string;
}) => {
  const sizeClasses = {
    medium: 'px-4 h-10 text-sm',
    large: 'px-6 h-12 text-base',
  };

  const variantClasses = {
    primary:
      'bg-[#171717] dark:bg-[#ededed] hover:bg-[#383838] dark:hover:bg-[#cccccc] text-white dark:text-[#0a0a0a]',
    secondary:
      'bg-white dark:bg-[#171717] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] text-[#171717] dark:text-[#ededed] border border-[#eaeaea] dark:border-[#333]',
  };

  const className = `flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-150 ${sizeClasses[size]} ${variantClasses[variant]}`;

  if (to) {
    return (
      <Link to={to} className={className}>
        <span>{children}</span>
        {suffix}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      <span>{children}</span>
      {suffix}
    </button>
  );
};

// Feature Card Component
const FeatureCard = ({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) => (
  <div className="rounded-xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-6">
    <div className="mb-4 inline-flex rounded-lg bg-[#fafafa] dark:bg-[#2a2a2a] p-3">
      <Icon className="h-6 w-6 text-[#171717] dark:text-[#ededed]" />
    </div>
    <h3 className="mb-2 text-lg font-medium text-[#171717] dark:text-[#ededed]">{title}</h3>
    <p className="text-[#666] dark:text-[#8f8f8f]">{description}</p>
  </div>
);

// Header Component
const Header = () => {
  const [starCount, setStarCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://api.github.com/repos/plenoai/pleno-audit')
      .then((res) => res.json())
      .then((data) => {
        if (data.stargazers_count !== undefined) {
          setStarCount(data.stargazers_count);
        }
      })
      .catch(() => { });
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#eaeaea] dark:border-[#333]">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#171717] dark:text-[#ededed]" />
            <span className="font-medium text-[#171717] dark:text-[#ededed]">Pleno Audit</span>
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] transition-colors"
          >
            <Github className="h-4 w-4 text-[#171717] dark:text-[#ededed]" />
            <span className="text-sm font-medium text-[#171717] dark:text-[#ededed]">GitHub</span>
            {starCount !== null && (
              <span className="flex items-center gap-1 text-sm text-[#666] dark:text-[#8f8f8f]">
                <Star className="h-3 w-3" />
                {starCount}
              </span>
            )}
          </a>
        </div>
      </div>
    </header>
  );
};

// Hero Section
const HeroSection = () => (
  <section className="relative w-full overflow-hidden bg-white dark:bg-[#0a0a0a] pb-16 pt-32 md:pb-24 md:pt-40">
    <div
      className="absolute right-0 top-0 h-1/2 w-1/2"
      style={{
        background:
          'radial-gradient(circle at 70% 30%, rgba(23, 23, 23, 0.05) 0%, rgba(255, 255, 255, 0) 60%)',
      }}
    />

    <div className="container relative z-10 mx-auto max-w-6xl px-4 text-center md:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] px-4 py-2 text-sm">
          <Shield className="h-4 w-4 text-[#171717] dark:text-[#ededed]" />
          <span className="text-[#171717] dark:text-[#ededed]">Personal Browser Security</span>
        </div>

        <h1 className="mx-auto mb-6 max-w-4xl text-5xl font-normal tracking-tight text-[#171717] dark:text-[#ededed] md:text-6xl lg:text-7xl">
          Secure Your Browser.
          <br />
          <span className="text-[#666] dark:text-[#8f8f8f]">Protect Your Data.</span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg text-[#666] dark:text-[#8f8f8f] md:text-xl">
          フィッシングサイトやプライバシーリスクをリアルタイムで検出し、
          あなたのブラウジングを守るセキュリティ拡張機能
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="primary" size="large" suffix={<Chrome className="h-4 w-4" />} to="https://github.com/plenoai/pleno-audit/releases">
            Chrome拡張をインストール
          </Button>
          <Button variant="secondary" size="large" suffix={<ArrowRight className="h-4 w-4" />} to="/docs">
            詳しく見る
          </Button>
        </div>
      </motion.div>

      <motion.div
        className="relative mt-16 md:mt-24"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
      >
        <div className="relative z-10 mx-auto max-w-5xl overflow-hidden rounded-2xl border border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#171717] p-2 shadow-lg dark:shadow-none">
          <img
            src={`${import.meta.env.BASE_URL}services.png`}
            alt="Services Screenshot"
            className="w-full rounded-xl"
          />
        </div>
      </motion.div>
    </div>
  </section>
);

// Features Section
const FeaturesSection = () => (
  <section className="bg-[#fafafa] dark:bg-[#111] py-24">
    <div className="container mx-auto max-w-6xl px-4 md:px-6">
      <motion.div
        className="mb-16 text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="mb-4 text-3xl font-normal text-[#171717] dark:text-[#ededed] md:text-4xl">
          主要機能
        </h2>
        <p className="mx-auto max-w-2xl text-[#666] dark:text-[#8f8f8f]">
          あなたのブラウジングを守る機能を搭載
        </p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <FeatureCard
            icon={Eye}
            title="サービス利用可視化"
            description="利用中のWebサービスを一覧表示"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <FeatureCard
            icon={Shield}
            title="セキュリティ監視"
            description="CSP違反やセキュリティヘッダーの欠如を検出"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <FeatureCard
            icon={AlertTriangle}
            title="フィッシング検出"
            description="NRD・Typosquatting検出で不審ドメインを特定"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <FeatureCard
            icon={Zap}
            title="AIプロンプト監視"
            description="ChatGPT等へのプロンプト送信を記録"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <FeatureCard
            icon={Lock}
            title="ログイン追跡"
            description="OAuth/SAMLなどの認証イベントを記録"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <FeatureCard
            icon={Eye}
            title="ダッシュボード"
            description="検出イベントの一覧とフィルタリング"
          />
        </motion.div>
      </div>
    </div>
  </section>
);

// Main App
export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0a0a0a]">
      <Header />
      <div className="flex-1">
        <HeroSection />
        <FeaturesSection />
      </div>
      <Footer />
    </div>
  );
}
