import React from 'react';

import WindowFrame from '@/componentsV2/bits/WindowFrame';

import styles from './styles.module.css';

export interface TerminalViewerProps extends React.HTMLAttributes<HTMLDivElement> {
  lines: string[];
  title?: string;
  showDots?: boolean;
  activeCursor?: boolean;
  maxHeight?: string;
  classNameOverride?: string;
}

export default function TerminalViewer({
  lines,
  title = 'terminal',
  showDots = true,
  activeCursor = false,
  maxHeight = '280px',
  classNameOverride,
  ...props
}: TerminalViewerProps): React.JSX.Element {
  const combinedClass = classNameOverride ?? styles.terminal;

  return (
    <WindowFrame
      title={title}
      dots={showDots}
      classNameOverride={combinedClass}
      {...props}
    >
      <div className={styles.console} style={{maxHeight}}>
        {lines.map((line, index) => {
          const isPrompt = line.startsWith('$');
          const isComment = line.startsWith('#');
          const isSuccess = line.startsWith('✓');

          const lineClasses = [
            styles.line,
            isPrompt ? styles.promptLine : '',
            isComment ? styles.commentLine : '',
            isSuccess ? styles.successLine : '',
          ]
            .filter(Boolean)
            .join(' ');

          const isLast = index === lines.length - 1;

          return (
            <p key={index} className={lineClasses}>
              {line}
              {isLast && activeCursor && (
                <span className={styles.cursor} aria-hidden="true">
                  ▋
                </span>
              )}
            </p>
          );
        })}
      </div>
    </WindowFrame>
  );
}
