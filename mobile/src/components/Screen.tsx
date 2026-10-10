import React from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { spacing } from '../theme';
import { makeStyles } from '../theme/ThemeContext';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  // Screens under a navigation header only need the bottom edge.
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ children, scroll = true, edges = ['bottom'], contentStyle }: Props) {
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <KeyboardAvoidingView style={styles.flex} behavior="height">
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle]}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { padding: spacing.md, paddingBottom: spacing.xl },
  }),
);
