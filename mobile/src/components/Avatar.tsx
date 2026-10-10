import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { makeStyles } from '../theme/ThemeContext';

/** Circular photo, or a default grey silhouette when there is no photo. */
export function Avatar({ uri, size }: { uri: string | null; size: number }) {
  const styles = useStyles();
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[styles.base, shape]} />;
  }
  return (
    <View style={[styles.base, styles.placeholder, shape]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={12} cy={9.2} r={4.3} fill="#FFFFFF" />
        <Path d="M3.5 22.5c0-4.9 3.8-8.2 8.5-8.2s8.5 3.3 8.5 8.2z" fill="#FFFFFF" />
      </Svg>
    </View>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    base: { overflow: 'hidden', backgroundColor: colors.border },
    placeholder: { backgroundColor: colors.avatar, alignItems: 'center', justifyContent: 'flex-end' },
  }),
);
