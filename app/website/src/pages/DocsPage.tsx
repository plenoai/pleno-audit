import { type JSX, useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import Footer from '../components/Footer';
import DocSidebar from './docs/DocSidebar';
import OverviewSection from './docs/sections/OverviewSection';
import GettingStartedSection from './docs/sections/GettingStartedSection';
import DomainSection from './docs/sections/DomainSection';
import ArchitectureSection from './docs/sections/ArchitectureSection';
import PrivacySection from './docs/sections/PrivacySection';
import {
  MAIN_SECTION_BY_SUBSECTION,
  SUBSECTION_IDS,
  DOMAIN_METADATA,
} from './docs/data';

type SectionRenderer = () => JSX.Element;

type SectionDefinition = {
  id: string;
  render: SectionRenderer;
  subsectionId?: string;
};

const domainRenderer = (domainId: string) => () => <DomainSection domainId={domainId} />;

const DOMAIN_IDS = Object.keys(DOMAIN_METADATA);

const SECTION_DEFINITIONS: SectionDefinition[] = [
  { id: 'overview', render: OverviewSection },
  { id: 'getting-started', render: GettingStartedSection },
  ...DOMAIN_IDS.flatMap((domainId) => {
    const render = domainRenderer(domainId);
    const meta = DOMAIN_METADATA[domainId];
    return [
      { id: domainId, render },
      ...meta.featureIds.map((featureId) => ({
        id: featureId,
        render,
        subsectionId: featureId,
      })),
    ];
  }),
  { id: 'architecture', render: ArchitectureSection },
  { id: 'browser-only', render: ArchitectureSection, subsectionId: 'browser-only' },
  {
    id: 'detection-only',
    render: ArchitectureSection,
    subsectionId: 'detection-only',
  },
  { id: 'tech-stack', render: ArchitectureSection, subsectionId: 'tech-stack' },
  { id: 'privacy', render: PrivacySection },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const sectionsById = useMemo(() => {
    return new Map(SECTION_DEFINITIONS.map((section) => [section.id, section]));
  }, []);

  const mainSectionKey = MAIN_SECTION_BY_SUBSECTION.get(activeSection) ?? activeSection;

  useEffect(() => {
    if (SUBSECTION_IDS.has(activeSection)) {
      setTimeout(() => {
        const element = document.getElementById(activeSection);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [activeSection]);

  const ActiveSection = sectionsById.get(activeSection)?.render ?? OverviewSection;

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
          ドキュメント
        </span>
      </header>

      <div className="flex flex-1">
        <DocSidebar
          activeSection={activeSection}
          onSectionChange={(id) => {
            setActiveSection(id);
            setIsMobileMenuOpen(false);
          }}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 pt-14 lg:pt-0 lg:ml-72">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <motion.div
              key={mainSectionKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ActiveSection />
            </motion.div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
