import React, { useState, useEffect } from 'react';
import { googleSignIn, initAuth, getAccessToken } from '../lib/driveAuth';
import { FolderOpen, LogIn, RefreshCw, File } from 'lucide-react';

export const DriveView: React.FC = () => {
  const [needsAuth, setNeedsAuth] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initAuth(
      async () => {
        setNeedsAuth(false);
        fetchFiles();
      },
      () => setNeedsAuth(true)
    );
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No token");
      const res = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=10', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      await googleSignIn();
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderOpen className="text-green-500" /> Google Drive
        </h2>
        {!needsAuth && (
            <button onClick={fetchFiles} className="p-2 hover:bg-zinc-800 rounded">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
        )}
      </div>

      {needsAuth ? (
        <div className="flex-1 flex items-center justify-center">
          <button 
            onClick={handleLogin}
            className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-lg font-bold hover:bg-zinc-200 transition-colors"
          >
            <LogIn size={20} /> Sign in with Google
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {files.map((file: any) => (
            <div key={file.id} className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                <File className="text-blue-500" />
                <span className="text-sm text-zinc-300">{file.name}</span>
            </div>
          ))}
          {files.length === 0 && <p className="text-zinc-500 italic">No files found.</p>}
        </div>
      )}
    </div>
  );
};
