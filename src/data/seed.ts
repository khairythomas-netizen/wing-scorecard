import type { Place, Profile, WingFlavour } from '../lib/types';
import { normalizeName } from '../lib/places/provider';

const place = (
  externalId: string,
  displayName: string,
  formattedAddress: string,
  lat: number,
  lng: number,
  city: string,
  region: string,
  country: string,
): Place => ({
  id: `mock:${externalId}`,
  externalId,
  provider: 'mock',
  displayName,
  normalizedName: normalizeName(displayName),
  formattedAddress,
  lat,
  lng,
  city,
  region,
  country,
});

/** Real coordinates so the map, distance and city rollups behave truthfully. */
export const SEED_PLACES: Place[] = [
  place('p_wingspot', 'The Wing Spot', '742 Queen St W, Toronto, ON M6J 1G1', 43.6465, -79.4108, 'Toronto', 'ON', 'Canada'),
  place('p_birdbar', 'Bird Bar', '128 Ossington Ave, Toronto, ON M6J 2Z5', 43.6479, -79.4204, 'Toronto', 'ON', 'Canada'),
  place('p_cluck', 'Cluck & Co.', '1055 Yonge St, Toronto, ON M4W 2L2', 43.6795, -79.3903, 'Toronto', 'ON', 'Canada'),
  place('p_smokehouse', 'Ember Smokehouse', '55 Mill St, Toronto, ON M5A 3C4', 43.6503, -79.3596, 'Toronto', 'ON', 'Canada'),
  place('p_drumflat', 'Drum & Flat', '2901 Dundas St W, Toronto, ON M6P 1Y8', 43.6656, -79.4661, 'Toronto', 'ON', 'Canada'),
  place('p_hotcoop', 'Hot Coop', '199 Danforth Ave, Toronto, ON M4K 1N2', 43.6763, -79.3524, 'Toronto', 'ON', 'Canada'),
  place('p_saucelab', 'Sauce Lab', '620 King St W, Toronto, ON M5V 1M6', 43.6446, -79.4001, 'Toronto', 'ON', 'Canada'),
  place('p_northsidewings', 'Northside Wings', '5150 Yonge St, North York, ON M2N 6L8', 43.7699, -79.4142, 'Toronto', 'ON', 'Canada'),
  place('p_brooklynbones', 'Brooklyn Bones', '311 Bedford Ave, Brooklyn, NY 11211', 40.7143, -73.9615, 'New York', 'NY', 'United States'),
  place('p_harlemhot', 'Harlem Hot Wing Co.', '2280 Frederick Douglass Blvd, New York, NY 10027', 40.8082, -73.9541, 'New York', 'NY', 'United States'),
];

const flavour = (id: string, name: string): WingFlavour => ({
  id,
  name,
  normalizedName: normalizeName(name),
});

export const SEED_FLAVOURS: WingFlavour[] = [
  flavour('f_buffalo', 'Buffalo'),
  flavour('f_hothoney', 'Hot Honey'),
  flavour('f_nashville', 'Nashville Hot'),
  flavour('f_lemonpepper', 'Lemon Pepper'),
  flavour('f_saltpepper', 'Salt & Pepper'),
  flavour('f_honeygarlic', 'Honey Garlic'),
  flavour('f_bbq', 'Smoky BBQ'),
  flavour('f_suicide', 'Suicide'),
  flavour('f_jerk', 'Jerk'),
  flavour('f_koreansoy', 'Korean Soy Garlic'),
];

const profile = (
  id: string,
  username: string,
  displayName: string,
  bio: string,
  avatarUrl: string,
  isPrivate = false,
): Profile => ({
  id,
  username,
  displayName,
  bio,
  avatarUrl,
  isPrivate,
  followerCount: 0,
  followingCount: 0,
  reviewCount: 0,
});

export const CURRENT_USER_ID = 'u_me';

export const SEED_PROFILES: Profile[] = [
  profile('u_me', 'you', 'You', 'Always looking for the next 10/10 wing.', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80'),
  profile('u_maya', 'mayaeats', 'Maya Okonkwo', 'Flats supremacist. Toronto.', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80'),
  profile('u_deshawn', 'dwingz', 'DeShawn Price', 'Sauce is a personality trait.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80'),
  profile('u_priya', 'priyapeppers', 'Priya Raman', '5 peppers or nothing. 🌶️', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80'),
  profile('u_tom', 'tomcrisp', 'Tom Beaulieu', 'Crispiness is a moral issue.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80', true),
];

/** Wing photography for seeded reviews. */
export const SEED_PHOTOS = [
  'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=1200&q=80',
  'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=1200&q=80',
  'https://images.unsplash.com/photo-1608039755401-742074f0548d?w=1200&q=80',
  'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=1200&q=80',
  'https://images.unsplash.com/photo-1606756790138-261d2b21cd75?w=1200&q=80',
  'https://images.unsplash.com/photo-1513639776629-7b61b0ac49cb?w=1200&q=80',
  'https://images.unsplash.com/photo-1580217593608-61931cefc821?w=1200&q=80',
  'https://images.unsplash.com/photo-1585325701956-60dd9c8553bc?w=1200&q=80',
];
