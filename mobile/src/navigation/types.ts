import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Login: undefined;
  Activate: undefined;
  Lock: undefined;
  Dashboard: undefined;
  Profile: undefined;
  Tracking: undefined;
  ExerciseList: { edit?: boolean } | undefined;
  Reports: undefined;
  AddReport: undefined;
  Counttill: undefined;
  SessionComplete: { completed: number; total: number };
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
