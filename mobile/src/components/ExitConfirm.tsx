import React, { useCallback, useState } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Put on screens where the Android back button would leave the app (Home, Login, Lock):
 * instead of closing straight away it asks "Exit the app?".
 */
export function ExitConfirm() {
  const [visible, setVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        setVisible(true);
        return true; // handled: don't close the app yet
      });
      return () => subscription.remove();
    }, []),
  );

  return (
    <ConfirmDialog
      visible={visible}
      title="Exit the app?"
      message="Do you want to close Painflame Clinic Exercise?"
      onCancel={() => setVisible(false)}
      onConfirm={() => {
        setVisible(false);
        BackHandler.exitApp();
      }}
    />
  );
}
