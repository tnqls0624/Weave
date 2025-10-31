import { useState, useEffect } from 'react';
import type { User, Location } from '../types';

const useSimulatedUsersLocation = (users: User[], currentUserPosition: Location | null): (User & { location: Location })[] => {
  const [userLocations, setUserLocations] = useState<(User & { location: Location })[]>(
    users.map(u => ({ ...u, location: u.initialLocation || { latitude: 37.7749, longitude: -122.4194 } }))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setUserLocations(currentLocations => 
        currentLocations.map(user => {
          const move = (Math.random() - 0.5) * 0.0002; // small random movement
          return {
            ...user,
            location: {
              latitude: user.location.latitude + move,
              longitude: user.location.longitude + move,
            }
          };
        })
      );
    }, 2000); // update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  return userLocations;
};

export default useSimulatedUsersLocation;
