import { Link } from 'react-router-dom';
import { Shield, Github } from 'lucide-react';

const GITHUB_URL = 'https://github.com/plenoai/pleno-audit';

export default function Footer() {
  return (
    <footer className="border-t border-[#eaeaea] dark:border-[#333] bg-white dark:bg-[#0a0a0a] py-12">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#171717] dark:text-[#ededed]" />
              <span className="font-medium text-[#171717] dark:text-[#ededed]">Pleno Audit</span>
            </div>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] transition-colors"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5 text-[#666] dark:text-[#8f8f8f] hover:text-[#171717] dark:hover:text-[#ededed]" />
            </a>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#666] dark:text-[#8f8f8f]">
            <Link
              to="/docs"
              className="hover:text-[#171717] dark:hover:text-[#ededed] transition-colors"
            >
              ドキュメント
            </Link>
            <a
              href="https://natbee.pages.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#171717] dark:hover:text-[#ededed] transition-colors"
            >
              運営会社
            </a>
            <Link
              to="/faq"
              className="hover:text-[#171717] dark:hover:text-[#ededed] transition-colors"
            >
              よくある質問
            </Link>
            <Link
              to="/privacy"
              className="hover:text-[#171717] dark:hover:text-[#ededed] transition-colors"
            >
              プライバシーポリシー
            </Link>
            <Link
              to="/terms"
              className="hover:text-[#171717] dark:hover:text-[#ededed] transition-colors"
            >
              利用規約
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
