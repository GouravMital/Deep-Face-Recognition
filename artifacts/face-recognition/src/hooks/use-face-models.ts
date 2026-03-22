import { useState, useEffect } from 'react';
import { loadFaceModels } from '../lib/face-api';

export function useFaceModels() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const initModels = async () => {
      try {
        const success = await loadFaceModels();
        if (mounted) {
          if (success) {
            setIsLoaded(true);
          } else {
            setError("Failed to load biometric models. Face recognition unavailable.");
            setIsLoaded(true);
          }
        }
      } catch (err) {
        if (mounted) {
          console.warn("Face model loading failed:", err);
          setIsLoaded(true);
        }
      }
    };

    initModels();

    return () => {
      mounted = false;
    };
  }, []);

  return { isLoaded, error };
}
