import type { Metadata } from 'next';
import { SettingsScreen } from '@/components/dash/settings-screen';

export const metadata: Metadata = { title: 'إعدادات المتجر' };

export default function SettingsPage() {
  return <SettingsScreen />;
}
