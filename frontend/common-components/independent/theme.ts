/**
 * Irish design tokens. Colours come from the app logo (green + mint).
 * Every common component reads from here, so one change restyles all platforms.
 */
export const colors = {
  primary: '#17A06A',
  primaryDark: '#0F7A50',
  primarySoft: '#D0EEDF',
  primaryTint: '#EEF8F3',
  background: '#F5F8F6',
  surface: '#FFFFFF',
  border: '#DDE6E1',
  text: '#13261D',
  textMuted: '#5D6F66',
  textOnPrimary: '#FFFFFF',
  danger: '#C93C3C',
  dangerSoft: '#FBE7E7',
  warning: '#A86B00',
  warningSoft: '#FFF3D6',
  info: '#2A63D4',
  infoSoft: '#E3ECFC',
  overlay: 'rgba(10, 25, 18, 0.45)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const font = {
  title: 24,
  h2: 18,
  h3: 16,
  body: 15,
  small: 13,
  tiny: 11,
} as const;

/** Max content width so the web app reads well on wide desktop screens. */
export const contentMaxWidth = 980;

export type JobStatus = 'Applied' | 'Interview in progress' | 'Rejected' | 'Successful';

export const statusColors: Record<JobStatus, { fg: string; bg: string; icon: string }> = {
  Applied: { fg: colors.info, bg: colors.infoSoft, icon: 'paper-plane-outline' },
  'Interview in progress': { fg: colors.warning, bg: colors.warningSoft, icon: 'chatbubbles-outline' },
  Rejected: { fg: colors.danger, bg: colors.dangerSoft, icon: 'close-circle-outline' },
  Successful: { fg: colors.primaryDark, bg: colors.primarySoft, icon: 'trophy-outline' },
};

export const shadow = {
  shadowColor: '#0B2A1C',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;
