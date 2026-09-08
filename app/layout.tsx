import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Monster Rancher Battle Card · Local Restoration',
  description: 'A private, local recreation of the Monster Farm Battle Card tabletop game.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
