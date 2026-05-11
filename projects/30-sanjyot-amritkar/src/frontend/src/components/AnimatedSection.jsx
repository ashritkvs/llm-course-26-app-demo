import useInView from '../hooks/useInView.js';

// Reusable scroll-based animation wrapper
// - Fades/slides section in when it enters viewport
// - Triggers only once
// - Supports function-as-children to drive staggered animations inside
const AnimatedSection = ({
  as: Component = 'div',
  className = '',
  children,
  threshold,
  rootMargin
}) => {
  const [ref, isVisible] = useInView({ threshold, rootMargin });

  const baseClass = 'saf-reveal';
  const visibleClass = isVisible ? ' saf-reveal-visible' : '';
  const combinedClassName = `${baseClass}${visibleClass}${className ? ` ${className}` : ''}`;

  return (
    <Component ref={ref} className={combinedClassName}>
      {typeof children === 'function' ? children({ isVisible }) : children}
    </Component>
  );
};

export default AnimatedSection;
