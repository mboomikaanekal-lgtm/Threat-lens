export type RiskTier = 'low' | 'medium' | 'high' | 'critical';

export interface Geolocation {
  country: string;
  city: string | null;
  lat: number;
  long: number;
}

export interface Alert {
  message_id: string;
  subject: string;
  from: string;
  date: string;
  risk_score: number; // 0 - 100 float scale
  risk_tier: RiskTier;
  contributing_factors: string[];
  geolocation: Geolocation | null;
}

export const TIER_CONFIG: Record<
  RiskTier,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    text: string;
    glow: string;
  }
> = {
  critical: {
    label: 'Critical',
    color: '#DC2626',
    bg: 'rgba(220, 38, 38, 0.1)',
    border: '#DC2626',
    text: '#DC2626',
    glow: 'rgba(220, 38, 38, 0.3)',
  },
  high: {
    label: 'High',
    color: '#EA580C',
    bg: 'rgba(234, 88, 12, 0.1)',
    border: '#EA580C',
    text: '#EA580C',
    glow: 'rgba(234, 88, 12, 0.3)',
  },
  medium: {
    label: 'Medium',
    color: '#CA8A04',
    bg: 'rgba(202, 138, 4, 0.1)',
    border: '#CA8A04',
    text: '#CA8A04',
    glow: 'rgba(202, 138, 4, 0.3)',
  },
  low: {
    label: 'Low',
    color: '#16A34A',
    bg: 'rgba(22, 163, 74, 0.1)',
    border: '#16A34A',
    text: '#16A34A',
    glow: 'rgba(22, 163, 74, 0.3)',
  },
};
