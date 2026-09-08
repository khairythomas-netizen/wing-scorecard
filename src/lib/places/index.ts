import { createGooglePlacesProvider } from './googlePlacesProvider';
import { mockPlacesProvider } from './mockPlacesProvider';
import type { PlacesProvider } from './provider';

/**
 * The single place that decides which provider the app runs on.
 * Set VITE_GOOGLE_PLACES_KEY to go live; everything else stays untouched.
 */
const key = import.meta.env.VITE_GOOGLE_PLACES_KEY as string | undefined;

export const placesProvider: PlacesProvider = key
  ? createGooglePlacesProvider(key)
  : mockPlacesProvider;

export * from './provider';
