import { AppleMaps, GoogleMaps } from "expo-maps";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useGeolocation } from "../hooks/useGeolocation";
import useSimulatedUsersLocation from "../hooks/useSimulatedUsersLocation";
import type { Event, User } from "../types";

interface MapViewProps {
  events: Event[];
  users: User[];
}

const MapViewComponent: React.FC<MapViewProps> = ({ events, users }) => {
  const currentUser = users.find((u) => u.id === "user1")!;
  const otherUsers = users.filter((u) => u.id !== "user1");

  const { position: userPosition, error: geoError } = useGeolocation();
  const simulatedUsers = useSimulatedUsersLocation(otherUsers, userPosition);

  // Center of the map, defaults to SF or current user's initial location
  const mapCenter = userPosition ||
    currentUser.initialLocation || { latitude: 37.7749, longitude: -122.4194 };

  const allUsersWithLocation = [
    { ...currentUser, location: userPosition || currentUser.initialLocation },
    ...simulatedUsers,
  ].filter((u) => u.location);

  // Use platform-specific map component
  const MapComponent = Platform.OS === "ios" ? AppleMaps.View : GoogleMaps.View;

  const markers = allUsersWithLocation.map((user) => ({
    id: user.id,
    coordinates: {
      latitude: user.location!.latitude,
      longitude: user.location!.longitude,
    },
    title: user.name,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}></View>
      <View style={styles.mapContainer}>
        {geoError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{geoError}</Text>
          </View>
        )}
        <MapComponent
          style={styles.map}
          cameraPosition={{
            coordinates: mapCenter,
            zoom: 15,
          }}
          markers={markers}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
  },
  mapContainer: {
    flex: 1,
    backgroundColor: "#eff6ff",
    position: "relative",
  },
  map: {
    flex: 1,
  },
  errorContainer: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#fee2e2",
    padding: 8,
    borderRadius: 6,
    zIndex: 10,
  },
  errorText: {
    fontSize: 14,
    color: "#991b1b",
  },
});

export default MapViewComponent;
