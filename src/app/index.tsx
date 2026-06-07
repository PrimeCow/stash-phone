import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useServerConfig } from '@/config/ServerConfigContext';

export default function Index() {
  const { isLoaded, isConfigured } = useServerConfig();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return <Redirect href={isConfigured ? '/(tabs)' : '/setup'} />;
}
