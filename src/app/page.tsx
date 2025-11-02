import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { primeDemoData } from '@/lib/store';

export default function Home() {
  primeDemoData();
  return <DashboardClient />;
}
