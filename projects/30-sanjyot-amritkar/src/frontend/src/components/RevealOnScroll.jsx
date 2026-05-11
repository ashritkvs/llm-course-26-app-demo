import useInView from '../hooks/useInView.js';

const RevealOnScroll = ({ as: Component = 'div', className = '', children, threshold, rootMargin }) => {
  const [ref, isVisible] = useInView({ threshold, rootMargin });

  const baseClass = 'saf-reveal';
  const visibleClass = isVisible ? ' saf-reveal-visible' : '';
  const combinedClassName = `${baseClass}${visibleClass}${className ? ` ${className}` : ''}`;

  return (
    <Component ref={ref} className={combinedClassName}>
      {children}
    </Component>
  );
};

export default RevealOnScroll;
