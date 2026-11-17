/**
 * The ONE place screens import UI components from.
 *
 * Each component is the common version unless the current platform folder
 * (platforms/web | android | ios) provides an override.
 */
import { Button as CommonButton } from '../independent/Button';
import { Card as CommonCard } from '../independent/Card';
import { TextField as CommonTextField } from '../independent/TextField';
import { platform } from './platform';

export const Button = platform.overrides.Button ?? CommonButton;
export const Card = platform.overrides.Card ?? CommonCard;
export const TextField = platform.overrides.TextField ?? CommonTextField;

export { Chip, ChipRow } from '../independent/Chip';
export { Dialog } from '../independent/Dialog';
export {
  Banner,
  EmptyState,
  Label,
  Loading,
  Muted,
  ScoreRing,
  SectionTitle,
  StatusBadge,
} from '../independent/Feedback';
export { MarkdownView } from '../independent/MarkdownView';
export { Row, Screen } from '../independent/Screen';
export { Segmented } from '../independent/Segmented';
export { ToastProvider, useToast } from '../independent/Toast';
export { colors, font, radius, spacing, statusColors } from '../independent/theme';
export type { JobStatus } from '../independent/theme';
export type { PickedFile } from '../independent/PlatformAdapter';
export { platform };
