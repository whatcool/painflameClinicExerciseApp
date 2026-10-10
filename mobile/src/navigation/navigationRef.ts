import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// Lets components outside the screens (the bottom navbar) navigate.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
