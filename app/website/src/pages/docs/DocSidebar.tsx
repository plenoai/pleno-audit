import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ChevronRight, X, Home, Bell } from 'lucide-react';
import { DOC_SECTIONS, DEFAULT_EXPANDED_SECTION_IDS } from './data';

interface DocSidebarProps {
  activeSection: string;
  onSectionChange: (id: string) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export default function DocSidebar({
  activeSection,
  onSectionChange,
  isMobileOpen,
  onMobileClose,
}: DocSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    DEFAULT_EXPANDED_SECTION_IDS
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-white dark:bg-[#0a0a0a] border-r border-[#eaeaea] dark:border-[#333] z-50
          transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#eaeaea] dark:border-[#333]">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#171717] dark:text-[#ededed]" />
            <span className="font-medium text-[#171717] dark:text-[#ededed]">
              Pleno Audit
            </span>
          </Link>
          <button
            onClick={onMobileClose}
            className="lg:hidden p-2 rounded-lg hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a]"
          >
            <X className="h-5 w-5 text-[#666] dark:text-[#8f8f8f]" />
          </button>
        </div>

        <div className="p-4 border-b border-[#eaeaea] dark:border-[#333]">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-[#666] dark:text-[#8f8f8f] hover:text-[#171717] dark:hover:text-[#ededed] transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>ホームに戻る</span>
          </Link>
        </div>

        <nav className="p-4 overflow-y-auto h-[calc(100%-120px)]">
          <ul className="space-y-1">
            {DOC_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isExpanded = expandedSections.has(section.id);
              const isActive = activeSection === section.id;

              return (
                <li key={section.id}>
                  <button
                    onClick={() => {
                      if (section.subsections) {
                        toggleSection(section.id);
                      }
                      onSectionChange(section.id);
                    }}
                    className={`
                      w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                      ${isActive
                        ? 'bg-[#f5f5f5] dark:bg-[#2a2a2a] text-[#171717] dark:text-[#ededed]'
                        : 'text-[#666] dark:text-[#8f8f8f] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] hover:text-[#171717] dark:hover:text-[#ededed]'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{section.title}</span>
                    </div>
                    {section.subsections && (
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      />
                    )}
                  </button>

                  {section.subsections && isExpanded && (
                    <ul className="mt-1 ml-6 space-y-1">
                      {section.subsections.map((sub) => (
                        <li key={sub.id}>
                          <button
                            onClick={() => onSectionChange(sub.id)}
                            className={`
                              w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                              ${activeSection === sub.id
                                ? 'bg-[#f5f5f5] dark:bg-[#2a2a2a] text-[#171717] dark:text-[#ededed]'
                                : 'text-[#666] dark:text-[#8f8f8f] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a]'
                              }
                            `}
                          >
                            {sub.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-6 pt-4 border-t border-[#eaeaea] dark:border-[#333]">
            <Link
              to="/alerts"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#666] dark:text-[#8f8f8f] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] hover:text-[#171717] dark:hover:text-[#ededed] transition-colors"
            >
              <Bell className="h-4 w-4" />
              <span>アラート Playbook</span>
            </Link>
          </div>
        </nav>
      </aside>
    </>
  );
}
