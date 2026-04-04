import FeatureDocCard from '../FeatureDocCard';
import { FEATURE_CARDS, DOMAIN_METADATA } from '../data';

interface DomainSectionProps {
  domainId: string;
}

export default function DomainSection({ domainId }: DomainSectionProps) {
  const meta = DOMAIN_METADATA[domainId];
  if (!meta) return null;

  const cards = meta.featureIds
    .map((id) => FEATURE_CARDS.find((c) => c.id === id))
    .filter(Boolean);

  return (
    <section id={domainId} className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium text-[#171717] dark:text-[#ededed]">
          {meta.title}
        </h1>
        <p className="mt-2 text-[#666] dark:text-[#8f8f8f]">
          {meta.description}
        </p>
      </div>

      <div className="space-y-8">
        {cards.map((feature) => (
          <FeatureDocCard key={feature!.id} {...feature!} />
        ))}
      </div>
    </section>
  );
}
