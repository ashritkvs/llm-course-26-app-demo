import {
  LetterCaseCapitalizeIcon,
  MixIcon,
  ReaderIcon,
  RocketIcon,
  StarIcon,
  TimerIcon,
} from '@radix-ui/react-icons';

export function Features() {
  const features = [
    {
      title: 'Instant Response',
      text: 'Provides immediate answers to customer inquiries, reducing wait times and enhancing the customer experience with prompt, accurate information.',
      icon: <RocketIcon className="size-10 text-[#FF4500]" />,
      stat: '0.23s',
      statLabel: 'AVG RESPONSE',
    },
    {
      title: '24/7 Availability',
      text: 'Operates around the clock, ensuring that customers can get support at any time, day or night, without relying on the availability of human agents.',
      icon: <TimerIcon className="size-10 text-[#FF4500]" />,
      stat: '99.97%',
      statLabel: 'UPTIME',
    },
    {
      title: 'Workflows',
      text: 'Automatically resolves common support tickets by providing relevant solutions, freeing up your support team to focus on more complex issues.',
      icon: <StarIcon className="size-10 text-[#FF4500]" />,
      stat: '14.2K',
      statLabel: 'RESOLVED',
    },
    {
      title: 'Multilingual Support',
      text: 'Interacts with customers in multiple languages, broadening your reach and ensuring that non-English speakers receive the same level of support.',
      icon: <LetterCaseCapitalizeIcon className="size-10 text-[#FF4500]" />,
      stat: '40+',
      statLabel: 'LANGUAGES',
    },
    {
      title: 'Continuous Learning',
      text: 'Uses machine learning to continuously improve responses based on new data and interactions, ensuring that it becomes more accurate and efficient.',
      icon: <ReaderIcon className="size-10 text-[#FF4500]" />,
      stat: '98.6%',
      statLabel: 'ACCURACY',
    },
    {
      title: 'Seamless Integration',
      text: 'Easily integrates with your existing customer support platforms and tools, allowing for a smooth transition and minimal disruption to your current workflow.',
      icon: <MixIcon className="size-10 text-[#FF4500]" />,
      stat: '50+',
      statLabel: 'INTEGRATIONS',
    },
  ];

  return (
    <section className="border-t border-[#FF4500] bg-background py-20 lg:py-[100px]">
      <div className="mb-14 px-5 text-center lg:mb-20">
        <p className="font-mono mb-3 text-[10px] uppercase tracking-[0.3em] text-[#FF4500]">
          {`// SYSTEM CAPABILITIES`}
        </p>
        <h2 className="font-display text-2xl font-black uppercase tracking-tight text-foreground md:text-3xl lg:text-4xl">
          Why should you use Answerify?
        </h2>
      </div>
      <div className="container mx-auto grid grid-cols-1 gap-px border border-[#FF4500] px-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => {
          return (
            <div
              className="flex flex-col gap-3 border border-[#FF4500]/20 bg-background p-6 transition-colors hover:bg-[#FF4500]/5"
              key={feature.title}
            >
              {feature.icon}
              <div className="mt-1 flex items-baseline justify-between">
                <h4 className="font-display text-lg font-black uppercase tracking-tight text-foreground">
                  {feature.title}
                </h4>
                <div className="text-right">
                  <div className="font-mono text-xl font-bold text-[#FF4500]">
                    {feature.stat}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-gray-600">
                    {feature.statLabel}
                  </div>
                </div>
              </div>
              <p className="font-mono text-xs leading-relaxed text-gray-400">
                {feature.text}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
