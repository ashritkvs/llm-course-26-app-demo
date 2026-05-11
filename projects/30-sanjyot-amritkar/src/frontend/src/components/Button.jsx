const Button = ({ children, variant = 'primary', ...props }) => {
  const base =
    'inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:w-auto disabled:cursor-not-allowed disabled:opacity-60';
  const variants = {
    primary:
      'bg-gradient-to-r from-indigo-500 via-indigo-600 to-slate-900 text-white shadow-sm hover:opacity-95 focus-visible:ring-indigo-300',
    secondary:
      'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 focus-visible:ring-slate-300',
    ghost: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
  };

  return (
    <button className={`${base} ${variants[variant]}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
