import { getUser } from '@/utils/auth';
import { redirect } from 'next/navigation';
import Navigation from '@/components/Navigation';
import ProspectSearchClient from '@/components/ProspectSearchClient';

export default async function ProspectsPage() {
  const user = await getUser();
  
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              🔍 Prospect Search
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Search for LinkedIn prospects and extract their contact information in bulk
            </p>
          </div>
        </div>
      </div>

      {/* Client Component for Search Functionality */}
      <ProspectSearchClient />
    </div>
  );
}