import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { TherapistGateProvider } from './src/context/TherapistGate';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/theme/ThemeContext';

function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <TherapistGateProvider>
              <RootNavigator />
            </TherapistGateProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
    // <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>

    //   <Text>App</Text>
    // </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

export default App;
