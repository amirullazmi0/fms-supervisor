// App identity: both FMS apps share colors, logo (yellow truck) and components; the label
// and the header chip tell them apart.
import { Truck } from 'lucide-react';

export const APP = {
  label: 'Supervisor',
  icon: Truck,
  // Logo tile classes (sidebar + sign-in).
  tile: 'bg-brand text-brand-foreground',
  // App chip next to the page title.
  chip: 'bg-brand-soft text-brand-foreground ring-1 ring-brand/50',
} as const;
