import React, { useLayoutEffect, useRef, useState } from 'react';

type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  showPasswordLabel: string;
  hidePasswordLabel: string;
};

export const PasswordInput: React.FC<PasswordInputProps> = ({
  className = '',
  showPasswordLabel,
  hidePasswordLabel,
  ...props
}) => {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  useLayoutEffect(() => {
    if (!pendingSelection.current || !inputRef.current) return;
    const { start, end } = pendingSelection.current;
    pendingSelection.current = null;
    inputRef.current.focus();
    inputRef.current.setSelectionRange(start, end);
  }, [visible]);

  const toggleVisibility = () => {
    const input = inputRef.current;
    if (input) {
      pendingSelection.current = {
        start: input.selectionStart ?? input.value.length,
        end: input.selectionEnd ?? input.value.length,
      };
    }
    setVisible((v) => !v);
  };

  return (
    <div className="relative">
      <input
        {...props}
        ref={inputRef}
        type={visible ? 'text' : 'password'}
        className={`${className} pe-12`.trim()}
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggleVisibility}
        className="absolute inset-y-0 end-0 flex items-center justify-center w-12 text-muted hover:text-foreground transition-colors"
        aria-label={visible ? hidePasswordLabel : showPasswordLabel}
        aria-pressed={visible}
      >
        <span className="material-symbols-outlined text-xl leading-none select-none pointer-events-none">
          {visible ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  );
};
