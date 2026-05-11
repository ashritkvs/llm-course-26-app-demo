import { useEffect, useRef, useState } from 'react';

// Simple one-time in-view observer for scroll-based reveals
const useInView = (options = {}) => {
  const elementRef = useRef(null);
  const [hasBeenInView, setHasBeenInView] = useState(false);

  useEffect(() => {
    if (hasBeenInView) return;

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setHasBeenInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setHasBeenInView(true);
            observer.disconnect();
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -10% 0px',
        ...options
      }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasBeenInView, options]);

  return [elementRef, hasBeenInView];
};

export default useInView;
