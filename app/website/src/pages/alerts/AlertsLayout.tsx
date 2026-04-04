import { useState } from 'react';
import { Menu } from 'lucide-react';
import Footer from '../../components/Footer';
import AlertSidebar from './AlertSidebar';

interface AlertsLayoutProps {
  activeAlertId: string | null;
  children: React.ReactNode;
}

export default function AlertsLayout({ activeAlertId, children }: AlertsLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0a0a0a]">
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white dark:bg-[#0a0a0a] border-b border-[#eaeaea] dark:border-[#333] z-30 flex items-center px-4">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 rounded-lg hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a]"
        >
          <Menu className="h-5 w-5 text-[#666] dark:text-[#8f8f8f]" />
        </button>
        <span className="ml-3 font-medium text-[#171717] dark:text-[#ededed]">
          プレイブック
        </span>
      </header>

      <div className="flex flex-1">
        <AlertSidebar
          activeAlertId={activeAlertId}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 pt-14 lg:pt-0 lg:ml-72">
          <div className="max-w-4xl mx-auto px-6 py-12">
            {children}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
