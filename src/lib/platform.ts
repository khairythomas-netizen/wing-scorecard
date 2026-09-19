import { Capacitor } from '@capacitor/core';

/**
 * One place that answers "are we inside the native shell?".
 *
 * WingZ ships twice from the same source: as a web app on GitHub Pages and as
 * a native app around the same bundle. Everything that differs between them is
 * gated here rather than scattered through features, so the web build keeps
 * working untouched and the native build adds behaviour rather than replacing
 * it.
 */
export const isNative = (): boolean => Capacitor.isNativePlatform();

export const platformName = (): 'ios' | 'android' | 'web' =>
  Capacitor.getPlatform() as 'ios' | 'android' | 'web';

export const isIOS = (): boolean => platformName() === 'ios';
