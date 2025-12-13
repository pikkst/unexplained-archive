import React from 'react';
import { Shield, Crown, Star, Award } from 'lucide-react';

interface ProBadgeProps {
  type: 'verified' | 'pro' | 'premium';
  level?: 'basic' | 'enhanced' | 'premium';
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const ProBadge: React.FC<ProBadgeProps> = ({
  type,
  level = 'basic',
  color,
  size = 'md',
  showLabel = true,
  className = ''
}) => {
  // Badge configuration based on type and level
  const getBadgeConfig = () => {
    if (type === 'verified') {
      const configs = {
        basic: {
          icon: Shield,
          bgColor: color || 'bg-gray-500/20',
          textColor: color ? `text-${color}-400` : 'text-gray-400',
          label: 'Verified',
          borderColor: color ? `border-${color}-500/50` : 'border-gray-500/50'
        },
        enhanced: {
          icon: Shield,
          bgColor: color || 'bg-blue-500/20',
          textColor: color ? `text-${color}-400` : 'text-blue-400',
          label: 'Verified',
          borderColor: color ? `border-${color}-500/50` : 'border-blue-500/50'
        },
        premium: {
          icon: Award,
          bgColor: color || 'bg-gold-500/20',
          textColor: color ? `text-${color}-400` : 'text-yellow-400',
          label: 'Premium Verified',
          borderColor: color ? `border-${color}-500/50` : 'border-yellow-500/50'
        }
      };
      return configs[level];
    }

    if (type === 'pro') {
      return {
        icon: Crown,
        bgColor: 'bg-purple-500/20',
        textColor: 'text-purple-400',
        label: 'Pro Member',
        borderColor: 'border-purple-500/50'
      };
    }

    if (type === 'premium') {
      return {
        icon: Star,
        bgColor: 'bg-gold-500/20',
        textColor: 'text-yellow-400',
        label: 'Premium',
        borderColor: 'border-yellow-500/50'
      };
    }

    // Default
    return {
      icon: Shield,
      bgColor: 'bg-blue-500/20',
      textColor: 'text-blue-400',
      label: 'Verified',
      borderColor: 'border-blue-500/50'
    };
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  // Size configurations
  const sizeClasses = {
    sm: {
      container: 'px-2 py-0.5 text-xs',
      icon: 'w-3 h-3',
      gap: 'gap-1'
    },
    md: {
      container: 'px-3 py-1 text-sm',
      icon: 'w-4 h-4',
      gap: 'gap-1.5'
    },
    lg: {
      container: 'px-4 py-2 text-base',
      icon: 'w-5 h-5',
      gap: 'gap-2'
    }
  };

  const sizes = sizeClasses[size];

  return (
    <span
      className={`
        inline-flex items-center ${sizes.gap} ${sizes.container}
        ${config.bgColor} ${config.textColor}
        rounded-full font-medium
        border ${config.borderColor}
        ${className}
      `}
      title={config.label}
    >
      <Icon className={sizes.icon} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};

// Helper hook to get badge props from verification status
export const useVerificationBadge = (verificationStatus: {
  verified: boolean;
  badge_color?: string | null;
  verification_level?: string | null;
}) => {
  if (!verificationStatus.verified) {
    return null;
  }

  const level = (verificationStatus.verification_level as 'basic' | 'enhanced' | 'premium') || 'basic';
  
  return {
    type: 'verified' as const,
    level,
    color: verificationStatus.badge_color || undefined
  };
};

// Helper hook for Pro membership badge
export const useProBadge = (isProMember: boolean, proSince?: string | null) => {
  if (!isProMember) {
    return null;
  }

  return {
    type: 'pro' as const,
    label: 'Pro Member',
    since: proSince
  };
};
