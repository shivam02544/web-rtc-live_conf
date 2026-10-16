import { redirect } from 'next/navigation';
import { decrypt } from '@/lib/auth';
import { cookies } from 'next/headers';
import { Dashboard } from '@/components/Dashboard';

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session');
  
  if (!session?.value) {
    redirect('/login');
  }

  const user = await decrypt(session.value);
  
  if (!user) {
    redirect('/login');
  }

  return <Dashboard user={{ id: user.userId, name: user.name, email: '' }} token={session.value} />;
}
