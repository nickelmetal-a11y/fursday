// Real-time GPS tracking service for sitter location during service

import { supabase } from './supabase';

const TRACKING_UPDATE_INTERVAL = 30000; // 30 seconds
const TRACKING_ACCURACY_THRESHOLD = 50; // meters
const MAX_TRACKING_DISTANCE = 5000; // 5 km (safety check)

export class GPSTrackerService {
  constructor(bookingId) {
    this.bookingId = bookingId;
    this.watcherId = null;
    this.lastPosition = null;
    this.lastUpdateTime = null;
    this.isTracking = false;
    this.callbacks = {
      onLocationUpdate: null,
      onError: null,
      onAccuracyWarning: null,
    };
  }

  // Start real-time tracking
  startTracking = async (callbacks = {}) => {
    if (this.isTracking) {
      console.warn('Tracking already in progress');
      return;
    }

    this.callbacks = { ...this.callbacks, ...callbacks };

    if (!navigator.geolocation) {
      const error = 'Geolocation not supported on this device';
      this.callbacks.onError?.(error);
      throw new Error(error);
    }

    try {
      this.isTracking = true;

      // Initial position
      const position = await this._getCurrentPosition();
      await this._updateTracking(position);

      // Continuous tracking
      this.watcherId = navigator.geolocation.watchPosition(
        (position) => this._onPositionUpdate(position),
        (error) => this._onTrackingError(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } catch (error) {
      this.isTracking = false;
      this.callbacks.onError?.(error.message);
      throw error;
    }
  };

  // Stop tracking
  stopTracking = async () => {
    if (this.watcherId) {
      navigator.geolocation.clearWatch(this.watcherId);
      this.watcherId = null;
    }

    this.isTracking = false;

    // Mark tracking as ended
    if (this.bookingId) {
      try {
        await supabase
          .from('booking_gps_tracks')
          .update({
            tracking_ended_at: new Date().toISOString(),
            status: 'completed',
          })
          .eq('booking_id', this.bookingId);
      } catch (error) {
        console.error('Error ending tracking:', error);
      }
    }
  };

  // Private: Get current position
  _getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  };

  // Private: Handle position update
  _onPositionUpdate = async (position) => {
    try {
      const now = Date.now();

      // Throttle updates
      if (this.lastUpdateTime && now - this.lastUpdateTime < TRACKING_UPDATE_INTERVAL) {
        return;
      }

      // Check accuracy
      if (position.coords.accuracy > TRACKING_ACCURACY_THRESHOLD) {
        this.callbacks.onAccuracyWarning?.({
          accuracy: position.coords.accuracy,
          threshold: TRACKING_ACCURACY_THRESHOLD,
        });
      }

      // Distance check (safety)
      if (this.lastPosition) {
        const distance = this._calculateDistance(
          this.lastPosition,
          position.coords
        );
        if (distance > MAX_TRACKING_DISTANCE) {
          console.warn('Suspiciously large distance jump:', distance);
          return;
        }
      }

      await this._updateTracking(position);
      this.lastUpdateTime = now;
    } catch (error) {
      console.error('Error updating position:', error);
      this.callbacks.onError?.(error.message);
    }
  };

  // Private: Handle tracking error
  _onTrackingError = (error) => {
    let errorMessage = 'Unknown location error';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timeout';
        break;
      default:
        errorMessage = error.message;
    }

    this.callbacks.onError?.(errorMessage);
  };

  // Private: Update tracking in database
  _updateTracking = async (position) => {
    if (!this.bookingId) return;

    try {
      const trackingData = {
        booking_id: this.bookingId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy),
        heading: position.coords.heading || null,
        speed: position.coords.speed || null,
        altitude: position.coords.altitude || null,
        timestamp: new Date(position.timestamp).toISOString(),
      };

      // Insert tracking point
      const { error } = await supabase
        .from('booking_gps_tracks')
        .insert(trackingData);

      if (error) throw error;

      // Notify callback
      this.callbacks.onLocationUpdate?.({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date(position.timestamp).toISOString(),
      });

      this.lastPosition = position.coords;
    } catch (error) {
      console.error('Error saving tracking data:', error);
    }
  };

  // Private: Calculate distance between two coordinates
  _calculateDistance = (coord1, coord2) => {
    const R = 6371000; // Earth radius in meters
    const lat1 = this._toRad(coord1.latitude);
    const lat2 = this._toRad(coord2.latitude);
    const deltaLat = this._toRad(coord2.latitude - coord1.latitude);
    const deltaLon = this._toRad(coord2.longitude - coord1.longitude);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Private: Convert degrees to radians
  _toRad = (degrees) => {
    return (degrees * Math.PI) / 180;
  };
}

// Singleton instance management
let trackerInstance = null;

export const createGPSTracker = (bookingId) => {
  return new GPSTrackerService(bookingId);
};

export const getGPSTracker = () => {
  return trackerInstance;
};

export const setGPSTracker = (tracker) => {
  trackerInstance = tracker;
};

// Utility: Get booking route map
export const getBookingTrackingRoute = async (bookingId) => {
  try {
    const { data, error } = await supabase
      .from('booking_gps_tracks')
      .select('latitude, longitude, accuracy, timestamp')
      .eq('booking_id', bookingId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    return {
      bookingId,
      points: data.map((point) => ({
        lat: point.latitude,
        lng: point.longitude,
        accuracy: point.accuracy,
        timestamp: point.timestamp,
      })),
      totalDistance: calculateTotalDistance(data),
      startTime: data[0]?.timestamp,
      endTime: data[data.length - 1]?.timestamp,
    };
  } catch (error) {
    console.error('Error fetching tracking route:', error);
    return null;
  }
};

// Utility: Calculate total distance from route
export const calculateTotalDistance = (points) => {
  if (!points || points.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < points.length; i++) {
    const distance = haversineDistance(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
    totalDistance += distance;
  }
  return totalDistance;
};

// Haversine formula for distance calculation
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default {
  GPSTrackerService,
  createGPSTracker,
  getGPSTracker,
  setGPSTracker,
  getBookingTrackingRoute,
  calculateTotalDistance,
  haversineDistance,
};
