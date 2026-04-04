import FeatureDocCard from '../FeatureDocCard';
import { FEATURE_CARDS, DOMAIN_METADATA } from '../data';

const DOMAIN_IDS = Object.keys(DOMAIN_METADATA);

export default function DomainSection() {
  return (
    <section className="space-y-16">
      {DOMAIN_IDS.map((domainId) => {
        const meta = DOMAIN_METADATA[domainId];
        const cards = meta.featureIds
          .map((id) => FEATURE_CARDS.find((c) => c.id === id))
          .filter(Boolean);

        return (
          <div key={domainId} id={domainId} className="space-y-8">
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
          </div>
        );
      })}
    </section>
  );
}
