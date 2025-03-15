'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function TestApiPage() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const testGetEndpoint = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/run-edge-and-lowess');
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      console.error('Error testing GET endpoint:', err);
    } finally {
      setLoading(false);
    }
  };

  const testPostEndpoint = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try with a path that doesn't include 'public/'
      const response = await fetch('/api/run-edge-and-lowess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imagePath: 'sample.png' })
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      console.error('Error testing POST endpoint:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">API Test Page</h1>
      
      <div className="flex gap-4 mb-8">
        <Button onClick={testGetEndpoint} disabled={loading}>
          Test GET Endpoint
        </Button>
        
        <Button onClick={testPostEndpoint} disabled={loading}>
          Test POST Endpoint
        </Button>
      </div>
      
      {loading && <p className="text-blue-500">Loading...</p>}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error:</p>
          <p>{error}</p>
        </div>
      )}
      
      {result && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <p className="font-bold">Result:</p>
          <pre className="mt-2 bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 