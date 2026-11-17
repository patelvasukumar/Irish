/** Pure helpers for the tracker filter bar. */
import type { JobFilters } from '../../services/dependent/api';

export const TIME_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
] as const;

export type TimeValue = (typeof TIME_OPTIONS)[number]['value'];

export interface FilterState {
  time: TimeValue;
  company: string | null;
  city: string | null;
  province: string | null;
  status: string | null;
  search: string;
}

export const EMPTY_FILTERS: FilterState = {
  time: 'all',
  company: null,
  city: null,
  province: null,
  status: null,
  search: '',
};

export function toQuery(f: FilterState): JobFilters {
  return {
    days: f.time === 'all' ? null : Number(f.time),
    company: f.company,
    city: f.city,
    province: f.province,
    status: f.status,
    search: f.search.trim() || null,
  };
}

export function activeFilterCount(f: FilterState): number {
  return [f.time !== 'all', f.company, f.city, f.province, f.status, f.search.trim()].filter(Boolean).length;
}

/** Tap a selected chip again to clear it. */
export function toggle(current: string | null, value: string): string | null {
  return current === value ? null : value;
}
