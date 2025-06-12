'use client';

import { useEffect, useState } from 'react';

interface Activity {
  id: string;
  userId: string;
  username: string;
  action: 'login' | 'logout' | 'extract_contact';
  details?: string;
  timestamp: string;
  linkedinUrl?: string;
  contactName?: string;
  success?: boolean;
}

export default function ActivityLog() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'login' | 'logout' | 'extract_contact'>('all');

  useEffect(() => {
    fetch('/api/admin/activities')
      .then(res => res.json())
      .then(data => {
        setActivities(data.activities || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching activities:', err);
        setLoading(false);
      });
  }, []);

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(activity => activity.action === filter);

  const getActionIcon = (action: string, success?: boolean) => {
    if (action === 'login') {
      return (
        <div className="bg-blue-100 rounded-full p-2">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
        </div>
      );
    } else if (action === 'logout') {
      return (
        <div className="bg-gray-100 rounded-full p-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>
      );
    } else if (action === 'extract_contact') {
      return (
        <div className={`${success ? 'bg-green-100' : 'bg-red-100'} rounded-full p-2`}>
          <svg className={`w-4 h-4 ${success ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Activity Log</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All Activities
          </button>
          <button
            onClick={() => setFilter('extract_contact')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'extract_contact' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Extractions
          </button>
          <button
            onClick={() => setFilter('login')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'login' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Logins
          </button>
          <button
            onClick={() => setFilter('logout')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'logout' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Logouts
          </button>
        </div>
      </div>

      {/* Activities Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredActivities.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No activities found
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredActivities.map(activity => (
                <tr key={activity.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getActionIcon(activity.action, activity.success)}
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {activity.username}
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: {activity.userId}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      activity.action === 'login' ? 'bg-blue-100 text-blue-800' :
                      activity.action === 'logout' ? 'bg-gray-100 text-gray-800' :
                      activity.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {activity.action.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{activity.details}</div>
                    {activity.linkedinUrl && (
                      <div className="text-xs text-gray-500 mt-1">
                        <a 
                          href={activity.linkedinUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {activity.linkedinUrl}
                        </a>
                      </div>
                    )}
                    {activity.contactName && (
                      <div className="text-xs text-gray-500 mt-1">
                        Contact: {activity.contactName}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(activity.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
} 