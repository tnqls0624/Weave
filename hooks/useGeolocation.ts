import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import type { Location as LocationType, User } from '../types';

interface GeolocationState {
  position: LocationType | null;
  error: string | null;
}

export const useGeolocation = (): GeolocationState => {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    error: null,
  });

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const watchPosition = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setState({ position: null, error: 'Permission to access location was denied' });
          return;
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (location) => {
            setState({
              position: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              },
              error: null,
            });
          }
        );
      } catch (err) {
        setState({ position: null, error: (err as Error).message });
      }
    };

    watchPosition();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  return state;
};

export default useGeolocation;
