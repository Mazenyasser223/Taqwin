import React from 'react';
import type { MessageDeliveryStatus } from '../../types';

interface MessageStatusIconProps {
  status?: MessageDeliveryStatus;
  className?: string;
}

export const MessageStatusIcon: React.FC<MessageStatusIconProps> = ({ status, className = '' }) => {
  if (!status) return null;
  const read = status === 'read';
  const delivered = status === 'delivered' || read;

  return (
    <span
      className={`inline-flex items-center shrink-0 ${read ? 'text-sky-300' : 'text-white/65'} ${className}`}
      title={read ? 'Seen' : delivered ? 'Delivered' : 'Sent'}
    >
      <span className="material-symbols-outlined text-[15px] leading-none">
        {delivered ? 'done_all' : 'check'}
      </span>
    </span>
  );
};
