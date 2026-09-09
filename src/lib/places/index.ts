import { createGooglePlacesProvider } from './googlePlacesProvider';
import { createOsmPlacesProvider } from './osmPlacesProvider';
import { mockPlacesProvider } from './mockPlacesProvider';
import type { PlacesProvider } from './provider';

/**
 * The single place that decides which provider the app runs on.
 *
 * Google when a key is configured, OpenStreetMap otherwise — both search the
 * whole world. The seeded mock is only for tests, which must not depend on a
 * network call.
 */
const key = import.meta.env.VITE_GOOGLE_PLACES_KEY as string | undefined;

export const placesProvider: PlacesProvider = key
  ? createGooglePlacesProvider(key)
  : createOsmPlacesProvider();

export { mockPlacesProvider };

export * from './provider';
