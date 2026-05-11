import Marquee from 'react-fast-marquee';

const items = [
  'Support Tickets',
  'Workflows',
  'Automation',
  'Integrations',
  'Escalations',
  'Productivity',
];

export function Slider() {
  return (
    <Marquee
      className="font-display z-1 border-y border-y-[#FF4500] bg-background py-4 sm:py-6"
      direction="left"
      speed={60}
    >
      {items.map((x) => {
        return (
          <span
            key={x}
            className="font-display mx-10 text-xl font-black uppercase tracking-widest text-foreground sm:text-2xl lg:text-4xl"
          >
            {x}
            <span className="ml-10 text-[#FF4500]">◆</span>
          </span>
        );
      })}
    </Marquee>
  );
}
